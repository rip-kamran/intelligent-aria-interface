// DuckDuckGo-backed web search for Aria (no API key required).
// Multi-endpoint: Instant Answer + HTML SERP + Lite SERP + Wikipedia, merged,
// deduped and re-ranked for accuracy.

export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  source?: string;
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
}

function normalizeUrl(href: string): string {
  let url = href;
  if (url.startsWith("//")) url = `https:${url}`;
  const match = url.match(/[?&]uddg=([^&]+)/);
  if (match?.[1]) {
    try {
      url = decodeURIComponent(match[1]);
    } catch {
      /* keep as-is */
    }
  }
  return url.split("#")[0] ?? url;
}

function dedupeKey(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}`;
  } catch {
    return url;
  }
}

async function timedFetch(url: string, init?: RequestInit, ms = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Instant Answer API — good for definitions, facts and entities. */
async function instantAnswer(query: string): Promise<SearchResult[]> {
  try {
    const res = await timedFetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
      { headers: { "User-Agent": UA } },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      AbstractText?: string;
      AbstractURL?: string;
      Heading?: string;
      Answer?: string;
      Definition?: string;
      DefinitionURL?: string;
      RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
    };
    const out: SearchResult[] = [];
    const text = data.Answer || data.AbstractText || data.Definition;
    if (text) {
      out.push({
        title: data.Heading || "DuckDuckGo Instant Answer",
        url: data.AbstractURL || data.DefinitionURL || "https://duckduckgo.com",
        snippet: text,
        source: "instant answer",
      });
    }
    for (const t of data.RelatedTopics ?? []) {
      if (out.length >= 3) break;
      if (t.Text && t.FirstURL) {
        out.push({ title: t.Text.slice(0, 90), url: t.FirstURL, snippet: t.Text, source: "related" });
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** HTML endpoint — general organic results. */
async function htmlResults(query: string, limit: number): Promise<SearchResult[]> {
  const res = await timedFetch(
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=wt-wt`,
    { headers: { "User-Agent": UA, Accept: "text/html" } },
  );
  if (!res.ok) return [];
  const html = await res.text();

  const results: SearchResult[] = [];
  const linkRe = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetRe = /<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
  const snippets: string[] = [];
  let s: RegExpExecArray | null;
  while ((s = snippetRe.exec(html)) !== null) snippets.push(stripTags(s[1] ?? ""));

  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = linkRe.exec(html)) !== null && results.length < limit) {
    const url = normalizeUrl(m[1] ?? "");
    const title = stripTags(m[2] ?? "");
    if (!url || !title || url.includes("duckduckgo.com/y.js")) {
      i += 1;
      continue;
    }
    results.push({ title, url, snippet: snippets[i] ?? "", source: "duckduckgo" });
    i += 1;
  }
  return results;
}

/** Lite endpoint — different backend/ranking, catches results the HTML SERP misses. */
async function liteResults(query: string, limit: number): Promise<SearchResult[]> {
  const res = await timedFetch("https://lite.duckduckgo.com/lite/", {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "text/html",
    },
    body: new URLSearchParams({ q: query, kl: "wt-wt" }).toString(),
  });
  if (!res.ok) return [];
  const html = await res.text();
  const results: SearchResult[] = [];
  const rowRe =
    /<a[^>]+class="result-link"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result-snippet"[^>]*>([\s\S]*?)<\/td>/g;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html)) !== null && results.length < limit) {
    const url = normalizeUrl(m[1] ?? "");
    const title = stripTags(m[2] ?? "");
    if (!url || !title) continue;
    results.push({ title, url, snippet: stripTags(m[3] ?? ""), source: "duckduckgo lite" });
  }
  return results;
}

/** Wikipedia — high-precision factual grounding. */
async function wikipediaResults(query: string): Promise<SearchResult[]> {
  try {
    const res = await timedFetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        query,
      )}&format=json&srlimit=2&origin=*`,
      { headers: { "User-Agent": UA } },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as {
      query?: { search?: Array<{ title: string; snippet: string }> };
    };
    return (json.query?.search ?? []).map((r) => ({
      title: `${r.title} — Wikipedia`,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, "_"))}`,
      snippet: stripTags(r.snippet),
      source: "wikipedia",
    }));
  } catch {
    return [];
  }
}

function scoreResult(r: SearchResult, terms: string[], rank: number, appearances: number) {
  const hay = `${r.title} ${r.snippet}`.toLowerCase();
  let score = appearances * 3 - rank * 0.5;
  for (const t of terms) if (hay.includes(t)) score += 1.5;
  if (r.snippet.length > 80) score += 1;
  if (r.source === "instant answer" || r.source === "wikipedia") score += 2;
  return score;
}

export async function duckDuckGoSearch(
  query: string,
  maxResults = 6,
): Promise<SearchResult[]> {
  const limit = Math.min(Math.max(maxResults, 1), 10);
  const q = query.trim().replace(/\s+/g, " ");
  const terms = q
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2 && !["the", "and", "for", "what", "who", "how", "why"].includes(t));

  const [answer, organic, lite, wiki] = await Promise.all([
    instantAnswer(q),
    htmlResults(q, limit + 4).catch(() => [] as SearchResult[]),
    liteResults(q, limit + 4).catch(() => [] as SearchResult[]),
    wikipediaResults(q),
  ]);

  const merged = new Map<string, { r: SearchResult; rank: number; hits: number }>();
  const feed = (list: SearchResult[]) =>
    list.forEach((r, i) => {
      const key = dedupeKey(r.url);
      const existing = merged.get(key);
      if (existing) {
        existing.hits += 1;
        if (r.snippet.length > existing.r.snippet.length) existing.r.snippet = r.snippet;
      } else {
        merged.set(key, { r, rank: i, hits: 1 });
      }
    });

  feed(answer);
  feed(organic);
  feed(lite);
  feed(wiki);

  return [...merged.values()]
    .sort((a, b) => scoreResult(b.r, terms, b.rank, b.hits) - scoreResult(a.r, terms, a.rank, a.hits))
    .slice(0, limit)
    .map((e) => e.r);
}

/** Fetch a page and return readable text (capped) so Aria can read a source. */
export async function fetchPageText(url: string, maxChars = 8000): Promise<string> {
  try {
    const res = await timedFetch(
      url,
      { headers: { "User-Agent": UA, Accept: "text/html" } },
      12000,
    );
    if (!res.ok) return `Could not open ${url} (status ${res.status}).`;
    const html = await res.text();
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<header[\s\S]*?<\/header>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<aside[\s\S]*?<\/aside>/gi, " ");
    // Prefer <article> or <main> when present — far less boilerplate.
    const main =
      cleaned.match(/<article[\s\S]*?<\/article>/i)?.[0] ??
      cleaned.match(/<main[\s\S]*?<\/main>/i)?.[0] ??
      cleaned;
    const title = stripTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
    const text = stripTags(main);
    return `${title ? `# ${title}\n` : ""}${text.slice(0, maxChars)}`;
  } catch {
    return `Could not open ${url}.`;
  }
}

/** Search, then read the top pages so answers are grounded in full text. */
export async function deepSearch(query: string, maxResults = 5) {
  const results = await duckDuckGoSearch(query, maxResults);
  const toRead = results.filter((r) => r.url.startsWith("http")).slice(0, 2);
  const pages = await Promise.all(
    toRead.map(async (r) => ({
      url: r.url,
      title: r.title,
      excerpt: (await fetchPageText(r.url, 3500)).slice(0, 3500),
    })),
  );
  return { query, results, pages };
}
