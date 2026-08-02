// Vector memory for Aria — embeddings via the Lovable AI Gateway + pgvector.

const EMBEDDING_MODEL = "openai/text-embedding-3-small"; // 1536 dims

export type MemoryHit = { id: string; content: string; kind: string; similarity: number };

export async function embed(text: string): Promise<number[] | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: text.slice(0, 8000) }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: Array<{ embedding: number[] }> };
    return json.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

/** Store a memory (deduped against very similar existing ones). */
export async function saveMemory(opts: {
  userId: string;
  content: string;
  kind?: string;
  threadId?: string | null;
}): Promise<{ saved: boolean; reason?: string }> {
  const content = opts.content.trim();
  if (content.length < 3) return { saved: false, reason: "too short" };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const vector = await embed(content);

  if (vector) {
    const { data: similar } = await supabaseAdmin.rpc("match_memories", {
      _user_id: opts.userId,
      query_embedding: vector as unknown as string,
      match_count: 1,
    });
    const top = (similar as MemoryHit[] | null)?.[0];
    if (top && top.similarity > 0.94) return { saved: false, reason: "already remembered" };
  }

  const { error } = await supabaseAdmin.from("memories").insert({
    user_id: opts.userId,
    content,
    kind: opts.kind ?? "fact",
    source_thread_id: opts.threadId ?? null,
    embedding: vector ? (vector as unknown as string) : null,
  });
  if (error) return { saved: false, reason: error.message };
  return { saved: true };
}

/** Retrieve the most relevant memories for a query. */
export async function recallMemories(
  userId: string,
  query: string,
  limit = 6,
): Promise<MemoryHit[]> {
  const vector = await embed(query);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!vector) {
    const { data } = await supabaseAdmin
      .from("memories")
      .select("id, content, kind")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data ?? []).map((m) => ({ ...m, similarity: 0 })) as MemoryHit[];
  }
  const { data } = await supabaseAdmin.rpc("match_memories", {
    _user_id: userId,
    query_embedding: vector as unknown as string,
    match_count: limit,
  });
  return ((data ?? []) as MemoryHit[]).filter((m) => m.similarity > 0.25);
}
