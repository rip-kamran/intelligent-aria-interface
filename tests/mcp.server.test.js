import { afterEach, expect, mock, test } from "bun:test";
import { buildMcpTools } from "../src/lib/mcp.server";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test("connected MCP tools are registered and callable by chat and Code", async () => {
  const methods = [];
  globalThis.fetch = mock(async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    methods.push(body.method);
    const result = body.method === "tools/list"
      ? { tools: [{ name: "lookup", inputSchema: { type: "object", properties: {} } }] }
      : body.method === "tools/call"
        ? { content: [{ type: "text", text: "current docs" }] }
        : {};
    return Response.json({ jsonrpc: "2.0", id: body.id, result });
  });
  const tools = await buildMcpTools([{ id: "docs", name: "Docs", url: "https://tools.example.com/mcp" }]);
  expect(Object.keys(tools)).toEqual(["mcp_docs_lookup"]);
  expect(await tools.mcp_docs_lookup.execute({})).toEqual({ result: "current docs" });
  expect(methods).toContain("tools/call");
});

test("an unavailable tool server does not remove working tools", async () => {
  globalThis.fetch = mock(async (input, init) => {
    if (String(input).includes("offline")) throw new Error("unavailable");
    const body = JSON.parse(String(init?.body));
    return Response.json({ result: body.method === "tools/list" ? { tools: [{ name: "lookup" }] } : {} });
  });
  const tools = await buildMcpTools([
    { id: "1", name: "Docs", url: "https://docs.example.com/mcp" },
    { id: "2", name: "Offline", url: "https://offline.example.com/mcp" },
  ]);
  expect(Object.keys(tools)).toEqual(["mcp_docs_lookup"]);
});