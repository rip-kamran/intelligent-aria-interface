// Minimal MCP (Model Context Protocol) client over streamable HTTP.
// Lets users plug external tool servers into Aria chat and Aria Code.
// Implemented with plain fetch (JSON-RPC + optional SSE responses) so it
// runs on the edge runtime without Node-only dependencies.

import { tool, jsonSchema } from "ai";

export type McpServerConfig = {
  id: string;
  name: string;
  url: string;
  auth_header?: string | null;
};

export type McpToolDef = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
};

const PROTOCOL_VERSION = "2025-03-26";
const TIMEOUT_MS = 12_000;
const MAX_TOOLS_PER_SERVER = 25;
const MAX_TOOL_RESULT_CHARS = 12_000;

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 24) || "server"
  );
}

type RpcResult = { result: unknown; sessionId?: string };

async function rpc(
  server: McpServerConfig,
  method: string,
  params: Record<string, unknown>,
  sessionId?: string,
  notify = false,
): Promise<RpcResult> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    "mcp-protocol-version": PROTOCOL_VERSION,
  };
  if (server.auth_header) headers.authorization = server.auth_header;
  if (sessionId) headers["mcp-session-id"] = sessionId;

  const res = await fetch(server.url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      ...(notify ? {} : { id: crypto.randomUUID() }),
      method,
      params,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const newSession = res.headers.get("mcp-session-id") ?? sessionId;
  if (notify) return { result: null, sessionId: newSession };
  if (!res.ok) throw new Error(`MCP server "${server.name}" responded ${res.status}`);

  const ct = res.headers.get("content-type") ?? "";
  let payload: { result?: unknown; error?: { message?: string } } | null = null;
  if (ct.includes("text/event-stream")) {
    const text = await res.text();
    for (const line of text.split("\n")) {
      if (!line.startsWith("data:")) continue;
      try {
        const msg = JSON.parse(line.slice(5).trim());
        if (msg.result !== undefined || msg.error) payload = msg;
      } catch {
        /* ignore non-JSON SSE lines */
      }
    }
  } else {
    payload = await res.json();
  }
  if (!payload) throw new Error(`MCP server "${server.name}" returned an empty response`);
  if (payload.error) {
    throw new Error(payload.error.message ?? `MCP error from "${server.name}"`);
  }
  return { result: payload.result, sessionId: newSession };
}

async function initialize(server: McpServerConfig): Promise<string | undefined> {
  const init = await rpc(server, "initialize", {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: "aria", version: "1.0" },
  });
  try {
    await rpc(server, "notifications/initialized", {}, init.sessionId, true);
  } catch {
    /* best effort */
  }
  return init.sessionId;
}

/** List the tools a server exposes. Throws with a readable message on failure. */
export async function listMcpTools(server: McpServerConfig): Promise<McpToolDef[]> {
  const sessionId = await initialize(server);
  const listed = await rpc(server, "tools/list", {}, sessionId);
  const tools = (listed.result as { tools?: McpToolDef[] } | null)?.tools;
  return Array.isArray(tools) ? tools.slice(0, MAX_TOOLS_PER_SERVER) : [];
}

/** Call one tool on a server (initializes a fresh session per call — edge-safe). */
export async function callMcpTool(
  server: McpServerConfig,
  toolName: string,
  args: Record<string, unknown>,
): Promise<string> {
  const sessionId = await initialize(server);
  const called = await rpc(server, "tools/call", { name: toolName, arguments: args }, sessionId);
  const result = called.result as
    | { content?: Array<{ type: string; text?: string }>; isError?: boolean }
    | null;
  const text = (result?.content ?? [])
    .map((c) => (c.type === "text" ? (c.text ?? "") : ""))
    .filter(Boolean)
    .join("\n");
  const out = text || JSON.stringify(result ?? {});
  if (result?.isError) throw new Error(out.slice(0, 500) || "Tool reported an error");
  return out.slice(0, MAX_TOOL_RESULT_CHARS);
}

/**
 * Turn every enabled MCP server into AI SDK tools, namespaced as
 * mcp_<server>_<tool>. Servers that fail to respond are skipped so one bad
 * endpoint never breaks a conversation.
 */
export async function buildMcpTools(
  servers: McpServerConfig[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Record<string, any>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, any> = {};
  const enabled = servers.filter((s) => s.url).slice(0, 10);
  const settled = await Promise.allSettled(
    enabled.map(async (server) => ({ server, defs: await listMcpTools(server) })),
  );
  for (const entry of settled) {
    if (entry.status !== "fulfilled") continue;
    const { server, defs } = entry.value;
    const prefix = `mcp_${slugify(server.name)}`;
    for (const def of defs) {
      const toolName = `${prefix}_${slugify(def.name)}`.slice(0, 64);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config: any = {
        description: `[${server.name}] ${(def.description ?? def.name).slice(0, 500)}`,
        inputSchema: jsonSchema(
          (def.inputSchema as never) ?? { type: "object", properties: {} },
        ),
        execute: async (args: Record<string, unknown>) => {
          try {
            return { result: await callMcpTool(server, def.name, args) };
          } catch (e) {
            return { error: e instanceof Error ? e.message : "Tool call failed" };
          }
        },
      };
      tools[toolName] = tool(config);
    }
  }
  return tools;
}
