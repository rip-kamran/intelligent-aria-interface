// In-memory sliding-window rate limiter (best-effort, per server instance).
// Not a distributed limiter: each edge instance keeps its own counters.
const hits = new Map<string, number[]>();
const WINDOW_MS = 60_000;
export const GUEST_LIMIT = 20;
export const AUTH_LIMIT = 60;
export const MAX_BODY_BYTES = 64 * 1024;

export function checkRateLimit(key: string, limit: number, now = Date.now()) {
  const list = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= limit) {
    hits.set(key, list);
    const retryAfter = Math.max(1, Math.ceil((WINDOW_MS - (now - list[0]!)) / 1000));
    return { allowed: false, retryAfter };
  }
  list.push(now);
  hits.set(key, list);
  if (hits.size > 20_000) {
    for (const [k, v] of hits) if (!v.length || now - v[v.length - 1]! > WINDOW_MS) hits.delete(k);
  }
  return { allowed: true, retryAfter: 0 };
}

function clientKey(request: Request) {
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const auth = request.headers.get("authorization");
  const isAuthed = !!auth?.startsWith("Bearer ") && auth.split(".").length === 3;
  // Authed users keyed by token tail so a shared IP doesn't punish everyone.
  return { key: isAuthed ? `t:${auth!.slice(-24)}` : `ip:${ip}`, isAuthed };
}

/** Returns a 429/413 Response when the request should be rejected, otherwise null. */
export function guardRequest(request: Request, scope: string): Response | null {
  const len = Number(request.headers.get("content-length") ?? 0);
  if (len > MAX_BODY_BYTES) return new Response("Payload too large.", { status: 413 });
  const { key, isAuthed } = clientKey(request);
  const r = checkRateLimit(`${scope}:${key}`, isAuthed ? AUTH_LIMIT : GUEST_LIMIT);
  if (!r.allowed) {
    return new Response("Too many requests. Please slow down.", {
      status: 429,
      headers: { "Retry-After": String(r.retryAfter) },
    });
  }
  return null;
}
