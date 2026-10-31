<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Aria Code has a dedicated authenticated `/code` route and separate quota; chat and Code share the MCP registry to keep connected tools consistent.
- Register remote MCP definitions with AI SDK `tool()` before returning the tool map; definitions alone do not make tools callable.
- Aria Code shell commands run in per-user E2B sandboxes via hand-rolled fetch in src/lib/sandbox.server.ts; the e2b SDK imports Node-only modules that break on the edge runtime.
