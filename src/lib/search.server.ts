// DuckDuckGo-backed web search for Aria (no API key required).

export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

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
  // DuckDuckGo wraps results in /l/?uddg=<encoded>
  const match = url.match(/[?&]uddg=([^&]+)/);
  if (match?.[1]) {
    try {
      url = decodeURIComponent(match[1]);
    } catch {
      /* keep as-is */
    }
  }
  return url;
}

/** Instant Answer API — good for definitions, facts and entities. */
async function instantAnswer(query: string): Promise<SearchResult | null> {
  try {
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
      { headers: { "User-Agent": "Mozilla/5.0 (compatible; AriaBot/1.0)" } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      AbstractText?: string;
      AbstractURL?: string;
      Heading?: string;
      Answer?: string;
    };
    const text = data.Answer || data.AbstractText;
    if (!text) return null;
    return {
      title: data.Heading || "DuckDuckGo Instant Answer",
      url: data.AbstractURL || "https://duckduckgo.com",
      snippet: text,
    };
  } catch {
    return null;
  }
}

/** HTML endpoint — general organic results. */
async function htmlResults(query: string, limit: number): Promise<SearchResult[]> {
  const res = await fetch("https://html.duckduckgo.com/html/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      Accept: "text/html",
    },
    body: new URLSearchParams({ q: query, kl: "wt-wt" }).toString(),
  });
  if (!res.ok) return [];
  const html = await res.text();

  const results: SearchResult[] = [];
  const linkRe =
    /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetRe =
    /<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
  const snippets: string[] = [];
  let s: RegExpExecArray | null;
  while ((s = snippetRe.exec(html)) !== null) snippets.push(stripTags(s[1] ?? ""));

  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = linkRe.exec(html)) !== null && results.length < limit) {
    const url = normalizeUrl(m[1] ?? "");
    const title = stripTags(m[2] ?? "");
    if (!url || !title) {
      i += 1;
      continue;
    }
    results.push({ title, url, snippet: snippets[i] ?? "" });
    i += 1;
  }
  return results;
}

export async function duckDuckGoSearch(
  query: string,
  maxResults = 6,
): Promise<SearchResult[]> {
  const limit = Math.min(Math.max(maxResults, 1), 10);
  const [answer, organic] = await Promise.all([
    instantAnswer(query),
    htmlResults(query, limit).catch(() => [] as SearchResult[]),
  ]);
  const out = answer ? [answer, ...organic] : organic;
  return out.slice(0, limit);
}

/** Fetch a page and return readable text (capped) so Aria can read a source. */
export async function fetchPageText(url: string, maxChars = 6000): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html",
      },
    });
    if (!res.ok) return `Could not open ${url} (status ${res.status}).`;
    const html = await res.text();
    const body = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
    const text = stripTags(body);
    return text.slice(0, maxChars);
  } catch {
    return `Could not open ${url}.`;
  }
}
