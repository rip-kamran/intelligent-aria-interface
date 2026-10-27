import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const serverInput = z.object({
  name: z.string().trim().min(1).max(60),
  url: z
    .string()
    .trim()
    .url()
    .max(500)
    .refine((u) => u.startsWith("https://"), "MCP servers must use https://"),
  auth_header: z.string().trim().max(500).nullable().optional(),
});

export const listMcpServers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("mcp_servers")
      .select("id, name, url, enabled, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const addMcpServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => serverInput.parse(d))
  .handler(async ({ data, context }) => {
    const { count } = await context.supabase
      .from("mcp_servers")
      .select("id", { count: "exact", head: true });
    if ((count ?? 0) >= 10) throw new Error("You can connect up to 10 tool servers.");
    const { error } = await context.supabase.from("mcp_servers").insert({
      user_id: context.userId,
      name: data.name,
      url: data.url,
      auth_header: data.auth_header || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleMcpServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("mcp_servers")
      .update({ enabled: data.enabled })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMcpServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("mcp_servers")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Try connecting to a server URL and report how many tools it exposes. */
export const testMcpServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => serverInput.parse(d))
  .handler(async ({ data }) => {
    try {
      const { listMcpTools } = await import("@/lib/mcp.server");
      const tools = await listMcpTools({
        id: "test",
        name: data.name,
        url: data.url,
        auth_header: data.auth_header || null,
      });
      return { ok: true as const, toolCount: tools.length, tools: tools.map((t) => t.name) };
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : "Could not reach that server",
      };
    }
  });
