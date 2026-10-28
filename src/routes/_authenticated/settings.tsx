import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast, Toaster } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { amIAdmin } from "@/lib/admin.functions";
import { ArrowLeft, Trash2, Brain, Plus } from "lucide-react";
import { AriaLogo } from "@/components/aria-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  CREDIT_PACKS,
  CREDIT_PURCHASE_ENABLED,
  EFFICIENCY_LIST,
  PLAN_CREDIT_COST,
  PLAN_REDEEM_DAYS,
  MODEL_LIST,
  MODELS,
  PLANS,
  PLAN_LIST,
  PROVIDERS,
  canUseModel,
  effectivePlan,
  formatTokens,
  USAGE_WINDOW_HOURS,
  type ModelId,
  type PlanId,
  type ProviderId,
  type EfficiencyId,
} from "@/lib/aria-prompts";

import {
  getProfile,
  updateProfile,
  listApiKeys,
  saveApiKey,
  deleteApiKey,
  RESPONSE_STYLES,
  RESPONSE_LENGTHS,
} from "@/lib/settings.functions";
import {
  listMemories,
  addMemory,
  deleteMemory,
  clearMemories,
  type MemoryRow,
} from "@/lib/memory.functions";
import { getCredits, redeemPlanWithCredits, type CreditsSummary } from "@/lib/credits.functions";
import {
  listMcpServers,
  addMcpServer,
  toggleMcpServer,
  deleteMcpServer,
  testMcpServer,
} from "@/lib/mcp.functions";
import { UsageMeter, useUsage } from "@/components/usage-meter";


export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Aria" },
      { name: "description", content: "Manage your Aria preferences, models, memory and connected tools." },
{ property: "og:title", content: "Settings — Aria" },
{ property: "og:description", content: "Manage your Aria preferences, models, memory and connected tools." },
{ property: "og:type", content: "website" },
{ name: "twitter:card", content: "summary" },
{ name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const getP = useServerFn(getProfile);
  const upP = useServerFn(updateProfile);
  const listK = useServerFn(listApiKeys);
  const saveK = useServerFn(saveApiKey);
  const delK = useServerFn(deleteApiKey);

  const listMem = useServerFn(listMemories);
  const addMem = useServerFn(addMemory);
  const delMem = useServerFn(deleteMemory);
  const clearMem = useServerFn(clearMemories);

  const [displayName, setDisplayName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [preferredModel, setPreferredModel] = useState<ModelId>("prose");
  const [plan, setPlan] = useState<PlanId>("free");
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [responseStyle, setResponseStyle] = useState<string>("default");
  const [responseLength, setResponseLength] = useState<string>("balanced");
  const [efficiency, setEfficiency] = useState<EfficiencyId>("mid");
  const { usage } = useUsage();
  const [keys, setKeys] = useState<Array<{ provider: string; masked: string }>>([]);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [newMemory, setNewMemory] = useState("");

  const refreshKeys = () => listK().then((k) => setKeys(k)).catch(() => {});
  const refreshMemories = () => listMem().then((m) => setMemories(m)).catch(() => {});

  useEffect(() => {
    getP()
      .then((p) => {
        const prof = p as Record<string, unknown>;
        setDisplayName(p.display_name || "");
        setInstructions(p.custom_instructions || "");
        setPreferredModel((p.preferred_model as ModelId) || "prose");
        setPlan(effectivePlan((((p as { plan?: string }).plan ?? "free") as PlanId)));
        setMemoryEnabled(prof.memory_enabled !== false);
        setWebSearchEnabled(prof.web_search_enabled !== false);
        setResponseStyle((prof.response_style as string) || "default");
        setResponseLength((prof.response_length as string) || "balanced");
        setEfficiency(((prof.efficiency as EfficiencyId) || "mid"));
      })
      .catch(() => {});

    refreshKeys();
    refreshMemories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await upP({
        data: {
          display_name: displayName || null,
          custom_instructions: instructions || null,
          preferred_model: preferredModel,
          memory_enabled: memoryEnabled,
          web_search_enabled: webSearchEnabled,
          response_style: responseStyle as (typeof RESPONSE_STYLES)[number],
          response_length: responseLength as (typeof RESPONSE_LENGTHS)[number],
          efficiency,
        },
      });
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);

    }
  };

  const saveKey = async (provider: ProviderId) => {
    const val = inputs[provider]?.trim();
    if (!val) return;
    try {
      await saveK({ data: { provider, api_key: val } });
      setInputs((s) => ({ ...s, [provider]: "" }));
      await refreshKeys();
      toast.success(`${PROVIDERS[provider].label} key saved`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const removeKey = async (provider: string) => {
    await delK({ data: { provider } });
    await refreshKeys();
  };

  const keyByProvider = (p: string) => keys.find((k) => k.provider === p);

  const handleAddMemory = async () => {
    const content = newMemory.trim();
    if (!content) return;
    try {
      await addMem({ data: { content } });
      setNewMemory("");
      toast.success("Memory saved");
      await refreshMemories();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save memory");
    }
  };

  const handleDeleteMemory = async (id: string) => {
    await delMem({ data: { id } });
    await refreshMemories();
  };

  const handleClearMemories = async () => {
    await clearMem();
    await refreshMemories();
    toast.success("All memories cleared");
  };



  return (
    <div className="min-h-screen bg-aria-hero">
      <Toaster theme="dark" />
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link to="/chat" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to chat
        </Link>

        <div className="mb-10 flex items-center gap-3">
          <AriaLogo className="h-9 w-9" />
          <h1 className="font-display text-4xl italic">Settings</h1>
          <AdminLink />
        </div>

        {/* Usage */}
        <section className="mb-10 rounded-2xl border border-border/60 bg-card/50 p-6 backdrop-blur">
          <h2 className="text-lg font-medium">Usage</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your daily allowance resets at midnight UTC.
          </p>
          <UsageMeter usage={usage} className="mt-4" showUpgrade={false} />
        </section>

        {/* Plan */}
        <section className="mb-10 rounded-2xl border border-border/60 bg-card/50 p-6 backdrop-blur">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-primary">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            Future upcoming update
          </span>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium">Your plan</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                You're on <span className="text-foreground">Aria {PLANS[plan].name}</span> —{" "}
                {formatTokens(PLANS[plan].windowTokens)} tokens every {USAGE_WINDOW_HOURS} hours.
              </p>
            </div>
            <span className="rounded-full border border-primary/40 px-3 py-1 text-xs text-primary">
              {PLANS[plan].name}
            </span>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {PLAN_LIST.map((p) => (
              <div
                key={p.id}
                className={`rounded-xl border p-4 ${
                  p.id === plan ? "border-primary/50 bg-primary/5" : "border-border/50 bg-background/40"
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="font-medium">{p.name}</h3>
                  <span className="text-sm">{p.price}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{p.blurb}</p>
                <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="text-primary">·</span>
                      {f}
                    </li>
                  ))}
                </ul>
                {p.id !== plan && p.id !== "free" && (
                  <Button
                    size="sm"
                    variant={p.highlight ? "default" : "secondary"}
                    className="mt-4 w-full rounded-lg"
                    onClick={() =>
                      toast("Upgrades are opening soon", {
                        description: `Aria ${p.name} will be available at ${p.price} ${p.period}.`,
                      })
                    }
                  >
                    {p.name} — coming soon
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>

        <CreditsSection />

        {/* Personalization */}

        <section className="mb-10 rounded-2xl border border-border/60 bg-card/50 p-6 backdrop-blur">
          <h2 className="text-lg font-medium">Personalization</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tell Aria who you are and how you'd like it to respond.
          </p>
          <div className="mt-5 space-y-4">
            <div>
              <Label htmlFor="name">Your name</Label>
              <Input
                id="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="What should Aria call you?"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="ci">Custom instructions</Label>
              <Textarea
                id="ci"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="e.g. Be concise. I'm a software engineer. Prefer TypeScript."
                rows={5}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="model">Default model</Label>
              <select
                id="model"
                value={preferredModel}
                onChange={(e) => setPreferredModel(e.target.value as ModelId)}
                className="mt-1 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
              >
                {MODEL_LIST.map((m) => {
                  const locked = !canUseModel(plan, m.id);
                  return (
                    <option key={m.id} value={m.id} disabled={locked}>
                      Aria {m.label} — {m.tagline}
                      {locked ? ` (${MODELS[m.id].tier === "max" ? "Max" : "Pro"})` : ""}
                    </option>
                  );
                })}

              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="style">Response style</Label>
                <select
                  id="style"
                  value={responseStyle}
                  onChange={(e) => setResponseStyle(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm capitalize"
                >
                  {RESPONSE_STYLES.map((s) => (
                    <option key={s} value={s} className="capitalize">
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="length">Response length</Label>
                <select
                  id="length"
                  value={responseLength}
                  onChange={(e) => setResponseLength(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm capitalize"
                >
                  {RESPONSE_LENGTHS.map((s) => (
                    <option key={s} value={s} className="capitalize">
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Label>Effort mode</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                How hard Aria works on each reply. Max thinks longer and uses more of your allowance.
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {EFFICIENCY_LIST.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setEfficiency(e.id)}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      efficiency === e.id
                        ? "border-primary/60 bg-primary/5"
                        : "border-border/50 bg-background/40 hover:bg-accent/40"
                    }`}
                  >
                    <span className="text-sm font-medium">{e.label}</span>
                    <span className="mt-1 block text-[11px] text-muted-foreground">{e.blurb}</span>
                    <span className="mt-1 block text-[10px] text-muted-foreground">
                      Costs {e.cost} message{e.cost > 1 ? "s" : ""}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-border/50 bg-background/40 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Long-term memory</p>
                  <p className="text-xs text-muted-foreground">
                    Let Aria remember facts about you across conversations.
                  </p>
                </div>
                <Switch checked={memoryEnabled} onCheckedChange={setMemoryEnabled} />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Web search</p>
                  <p className="text-xs text-muted-foreground">
                    Allow Aria to browse the live web for up-to-date answers.
                  </p>
                </div>
                <Switch checked={webSearchEnabled} onCheckedChange={setWebSearchEnabled} />
              </div>
            </div>

            <Button onClick={saveProfile} disabled={saving} className="rounded-lg">
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </section>

        {/* Memory */}
        <section className="mb-10 rounded-2xl border border-border/60 bg-card/50 p-6 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-medium">
                <Brain className="h-4 w-4 text-primary" /> Memory
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                What Aria remembers about you. Add or remove anything at any time.
              </p>
            </div>
            {memories.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleClearMemories}>
                Clear all
              </Button>
            )}
          </div>

          <div className="mt-5 flex gap-2">
            <Input
              value={newMemory}
              onChange={(e) => setNewMemory(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleAddMemory();
                }
              }}
              placeholder="e.g. I'm building an app called Aria"
            />
            <Button onClick={handleAddMemory} className="rounded-lg">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-4 space-y-2">
            {memories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No memories yet — Aria will save useful details as you chat.
              </p>
            ) : (
              memories.map((m) => (
                <div
                  key={m.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border/50 bg-background/40 px-3 py-2"
                >
                  <p className="text-sm leading-relaxed">{m.content}</p>
                  <button
                    onClick={() => handleDeleteMemory(m.id)}
                    className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                    aria-label="Delete memory"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>


        {/* API Keys */}
        <section className="rounded-2xl border border-border/60 bg-card/50 p-6 backdrop-blur">
          <h2 className="text-lg font-medium">Your API keys</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Bring your own keys. Aria uses the primary provider for each model, then falls back to backups. Without keys, Aria falls back to the free tier.
          </p>
          <div className="mt-6 space-y-6">
            {MODEL_LIST.map((m) => (
              <div key={m.id} className="rounded-xl border border-border/50 bg-background/40 p-4">
                <div className="mb-3 flex items-baseline justify-between">
                  <h3 className="font-medium">Aria {m.label}</h3>
                  <span className="text-xs text-muted-foreground">{m.tagline}</span>
                </div>
                <div className="space-y-3">
                  {m.chain.map((pid) => {
                    const p = PROVIDERS[pid];
                    const existing = keyByProvider(pid);
                    return (
                      <div key={pid} className="flex flex-wrap items-center gap-2">
                        <div className="min-w-32 flex-1">
                          <div className="text-sm font-medium">{p.label}</div>
                          <a
                            href={p.docsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-muted-foreground hover:text-primary"
                          >
                            Get key →
                          </a>
                        </div>
                        {existing ? (
                          <>
                            <code className="rounded bg-muted px-2 py-1 text-xs">{existing.masked}</code>
                            <button
                              onClick={() => removeKey(pid)}
                              className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                              aria-label="Remove key"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <Input
                              type="password"
                              value={inputs[pid] || ""}
                              onChange={(e) => setInputs((s) => ({ ...s, [pid]: e.target.value }))}
                              placeholder={p.keyPlaceholder}
                              className="h-8 max-w-xs text-xs"
                            />
                            <Button size="sm" onClick={() => saveKey(pid)} className="h-8">
                              Save
                            </Button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <McpServersSection />
      </div>
    </div>
  );
}

/** Connected external tool servers (MCP) — usable in chat and Aria Code. */
function McpServersSection() {
  const list = useServerFn(listMcpServers);
  const add = useServerFn(addMcpServer);
  const toggle = useServerFn(toggleMcpServer);
  const del = useServerFn(deleteMcpServer);
  const test = useServerFn(testMcpServer);

  type ServerRow = { id: string; name: string; url: string; enabled: boolean };
  const [servers, setServers] = useState<ServerRow[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [authHeader, setAuthHeader] = useState("");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);

  const refresh = () => list().then((s) => setServers(s as ServerRow[])).catch(() => {});
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = async () => {
    if (!name.trim() || !url.trim()) return;
    setBusy(true);
    try {
      await add({
        data: { name: name.trim(), url: url.trim(), auth_header: authHeader.trim() || null },
      });
      setName("");
      setUrl("");
      setAuthHeader("");
      toast.success("Tool server connected");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to connect server");
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    if (!name.trim() || !url.trim()) {
      toast.error("Enter a name and URL first");
      return;
    }
    setTesting(true);
    try {
      const res = await test({
        data: { name: name.trim(), url: url.trim(), auth_header: authHeader.trim() || null },
      });
      if (res.ok) {
        toast.success(
          res.toolCount > 0
            ? `Connected — ${res.toolCount} tools available: ${res.tools.slice(0, 5).join(", ")}${res.toolCount > 5 ? "…" : ""}`
            : "Connected, but the server exposes no tools.",
        );
      } else {
        toast.error(res.error);
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <section className="mt-10 border-t border-border/60 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium">Connected tools</h2>
        <Button asChild size="sm" variant="outline"><Link to="/code">Aria Code</Link></Button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Plug in external MCP tool servers. Aria can use their tools in both chat
        and Aria Code — for example GitHub, Notion, Linear or your own APIs.
      </p>

      <div className="mt-5 space-y-3">
        {servers.length === 0 && (
          <p className="text-sm text-muted-foreground">No tools connected yet.</p>
        )}
        {servers.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/40 px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{s.name}</p>
              <p className="truncate text-xs text-muted-foreground">{s.url}</p>
            </div>
            <Switch
              checked={s.enabled}
              onCheckedChange={async (enabled) => {
                await toggle({ data: { id: s.id, enabled } });
                await refresh();
              }}
              aria-label={`Enable ${s.name}`}
            />
            <Button variant="ghost" size="icon"
              onClick={async () => {
                await del({ data: { id: s.id } });
                await refresh();
              }}
              className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
              aria-label={`Remove ${s.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-3 rounded-xl border border-dashed border-border/60 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="mcp-name" className="text-xs">Name</Label>
            <Input
              id="mcp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="GitHub"
              className="mt-1 h-9 text-sm"
              maxLength={60}
            />
          </div>
          <div>
            <Label htmlFor="mcp-url" className="text-xs">Server URL (https)</Label>
            <Input
              id="mcp-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://mcp.example.com/mcp"
              className="mt-1 h-9 text-sm"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="mcp-auth" className="text-xs">
            Authorization header <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="mcp-auth"
            type="password"
            value={authHeader}
            onChange={(e) => setAuthHeader(e.target.value)}
            placeholder="Bearer …"
            className="mt-1 h-9 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleTest} disabled={testing || busy}>
            {testing ? "Testing…" : "Test connection"}
          </Button>
          <Button size="sm" onClick={handleAdd} disabled={busy || testing || !name.trim() || !url.trim()}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Connect
          </Button>
        </div>
      </div>
    </section>
  );
}

/** Shown only to admins: shortcut into the admin console. */
function AdminLink() {
  const check = useServerFn(amIAdmin);
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    check()
      .then((r) => setIsAdmin(r.isAdmin))
      .catch(() => {});
  }, [check]);
  if (!isAdmin) return null;
  return (
    <Link
      to="/admin"
      className="ml-auto flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary hover:bg-primary/20"
    >
      Admin console
    </Link>
  );
}

function CreditsSection() {
  const load = useServerFn(getCredits);
  const redeem = useServerFn(redeemPlanWithCredits);
  const [summary, setSummary] = useState<CreditsSummary | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => load().then(setSummary).catch(() => {});
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRedeem = async (plan: "pro" | "max") => {
    setBusy(true);
    try {
      await redeem({ data: { plan } });
      toast.success(`Aria ${plan === "pro" ? "Pro" : "Max"} unlocked for ${PLAN_REDEEM_DAYS} days`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't redeem credits");
    } finally {
      setBusy(false);
    }
  };

  const balance = summary?.credits ?? 0;

  return (
    <section className="mb-10 rounded-2xl border border-border/60 bg-card/50 p-6 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">Credits</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Spend credits on Aria Pro or Max — no subscription needed.
          </p>
        </div>
        <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-sm text-primary">
          {balance.toLocaleString()} credits
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {CREDIT_PACKS.map((pack) => (
          <div
            key={pack.id}
            className={`rounded-xl border p-4 ${
              pack.highlight ? "border-primary/50 bg-primary/5" : "border-border/50 bg-background/40"
            }`}
          >
            <div className="flex items-baseline justify-between">
              <h3 className="font-medium">{pack.credits.toLocaleString()} credits</h3>
              <span className="text-sm">{pack.price}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{pack.blurb}</p>
            <Button
              size="sm"
              variant="secondary"
              disabled
              className="mt-4 w-full rounded-lg"
            >
              {CREDIT_PURCHASE_ENABLED ? "Buy credits" : "Coming soon"}
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {(["pro", "max"] as const).map((p) => (
          <div key={p} className="rounded-xl border border-border/50 bg-background/40 p-4">
            <div className="flex items-baseline justify-between">
              <h3 className="font-medium">Aria {PLANS[p].name}</h3>
              <span className="text-sm">{PLAN_CREDIT_COST[p]} credits</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {PLAN_REDEEM_DAYS} days of {PLANS[p].name} access.
            </p>
            <Button
              size="sm"
              className="mt-4 w-full rounded-lg"
              disabled={busy || balance < PLAN_CREDIT_COST[p]}
              onClick={() => handleRedeem(p)}
            >
              {balance < PLAN_CREDIT_COST[p] ? "Not enough credits" : `Redeem ${PLAN_CREDIT_COST[p]} credits`}
            </Button>
          </div>
        ))}
      </div>

      {summary && summary.history.length > 0 && (
        <div className="mt-6">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Recent activity</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {summary.history.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 border-b border-border/40 py-1.5">
                <span className="truncate text-muted-foreground">{h.reason}</span>
                <span className={h.amount >= 0 ? "text-primary" : "text-muted-foreground"}>
                  {h.amount >= 0 ? "+" : ""}
                  {h.amount}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
