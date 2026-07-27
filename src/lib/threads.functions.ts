import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type StoredMessage = { id: string; role: string; parts: unknown };

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("threads")
      .select("id, title, model, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ threadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const [{ data: thread }, { data: msgs }] = await Promise.all([
      context.supabase
        .from("threads")
        .select("id, title, model")
        .eq("id", data.threadId)
        .maybeSingle(),
      context.supabase
        .from("messages")
        .select("id, message_id, role, parts, created_at")
        .eq("thread_id", data.threadId)
        .order("created_at", { ascending: true }),
    ]);
    const messages: StoredMessage[] = (msgs ?? []).map((m) => ({
      id: (m.message_id as string) || (m.id as string),
      role: m.role as string,
      parts: m.parts as unknown,
    }));
    return { thread: thread ?? null, messages };
  });

export const deleteThreadFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ threadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("threads").delete().eq("id", data.threadId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateThreadModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ threadId: z.string().uuid(), model: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("threads")
      .update({ model: data.model })
      .eq("id", data.threadId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const searchThreads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ q: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    // Match titles OR message text.
    const q = `%${data.q}%`;
    const [titles, msgs] = await Promise.all([
      context.supabase
        .from("threads")
        .select("id, title, updated_at")
        .ilike("title", q)
        .order("updated_at", { ascending: false })
        .limit(20),
      context.supabase
        .from("messages")
        .select("thread_id, parts, created_at, threads!inner(id, title, updated_at)")
        .ilike("parts::text", q)
        .order("created_at", { ascending: false })
        .limit(40),
    ]);
    const seen = new Set<string>();
    const results: Array<{ id: string; title: string; updated_at: string }> = [];
    for (const t of titles.data ?? []) {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        results.push(t as { id: string; title: string; updated_at: string });
      }
    }
    for (const m of msgs.data ?? []) {
      const th = (m as { threads: { id: string; title: string; updated_at: string } }).threads;
      if (th && !seen.has(th.id)) {
        seen.add(th.id);
        results.push(th);
      }
    }
    return results;
  });
