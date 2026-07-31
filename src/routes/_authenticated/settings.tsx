import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast, Toaster } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Trash2 } from "lucide-react";
import { AriaLogo } from "@/components/aria-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MODEL_LIST,
  MODELS,
  PLANS,
  PLAN_LIST,
  PROVIDERS,
  canUseModel,
  effectivePlan,
  type ModelId,
  type PlanId,
  type ProviderId,
} from "@/lib/aria-prompts";

import {
  getProfile,
  updateProfile,
  listApiKeys,
  saveApiKey,
  deleteApiKey,
} from "@/lib/settings.functions";
import { UsageMeter, useUsage } from "@/components/usage-meter";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Aria" },
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

  const [displayName, setDisplayName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [preferredModel, setPreferredModel] = useState<ModelId>("prose");
  const [plan, setPlan] = useState<PlanId>("free");
  const { usage } = useUsage();
  const [keys, setKeys] = useState<Array<{ provider: string; masked: string }>>([]);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const refreshKeys = () => listK().then((k) => setKeys(k)).catch(() => {});

  useEffect(() => {
    getP()
      .then((p) => {
        setDisplayName(p.display_name || "");
        setInstructions(p.custom_instructions || "");
        setPreferredModel((p.preferred_model as ModelId) || "prose");
        setPlan(effectivePlan((((p as { plan?: string }).plan ?? "free") as PlanId)));
      })
      .catch(() => {});

    refreshKeys();
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
                {PLANS[plan].dailyMessages.toLocaleString()} messages per day.
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
            <Button onClick={saveProfile} disabled={saving} className="rounded-lg">
              {saving ? "Saving…" : "Save"}
            </Button>
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
      </div>
    </div>
  );
}
