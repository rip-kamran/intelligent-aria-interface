import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  ChevronRight,
  Code2,
  Cpu,
  Loader2,
  RotateCcw,
  Send,
  Square,
  Settings,
  Wrench,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AriaLogo } from "@/components/aria-logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MODELS, formatTokens, type CodeModelId } from "@/lib/aria-prompts";
import { CODE_MODEL_IDS } from "@/lib/aria-prompts";
import { getCodeUsage, type CodeUsageSummary } from "@/lib/code.functions";

export const Route = createFileRoute("/_authenticated/code")({
  head: () => ({
    meta: [
      { title: "Aria Code — autonomous engineering mode" },
      { name: "description", content: "Build and debug with Aria Code, live research and your connected tools." },
{ property: "og:title", content: "Aria Code — autonomous engineering mode" },
{ property: "og:description", content: "Build and debug with Aria Code, live research and your connected tools." },
{ property: "og:type", content: "website" },
{ name: "twitter:card", content: "summary" },
{ name: "robots", content: "noindex" },
    ],
  }),
  component: AriaCode,
});

const CODE_MODELS = CODE_MODEL_IDS.map((id) => MODELS[id]);

function QuotaBar({
  label,
  used,
  limit,
  resetAt,
}: {
  label: string;
  used: number;
  limit: number;
  resetAt: string;
}) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const ms = new Date(resetAt).getTime() - Date.now();
  const hours = Math.max(0, Math.floor(ms / 3_600_000));
  const resetLabel =
    hours >= 48 ? `resets in ${Math.ceil(hours / 24)}d` : `resets in ${hours}h`;
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground/60">
        <span>{label}</span>
        <span className="tabular-nums">
          {formatTokens(used)} / {formatTokens(limit)}
        </span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            pct >= 100 ? "bg-destructive" : pct >= 90 ? "bg-code-warning" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground/40">{resetLabel}</p>
    </div>
  );
}

function AriaCode() {
  const [model, setModel] = useState<CodeModelId>("fable");
  const [input, setInput] = useState("");
  const [usage, setUsage] = useState<CodeUsageSummary | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const usageFn = useServerFn(getCodeUsage);
  const refreshUsage = useCallback(() => {
    usageFn()
      .then((u) => setUsage(u as CodeUsageSummary))
      .catch(() => {});
  }, [usageFn]);
  useEffect(() => {
    refreshUsage();
  }, [refreshUsage]);

  const { messages, sendMessage, setMessages, status, error, stop } = useChat({
    id: "aria-code-session",
    onFinish: () => refreshUsage(),
    transport: new DefaultChatTransport({
      api: "/api/code",
      fetch: async (input, init) => {
        const { data } = await supabase.auth.getSession();
        const headers = new Headers(init?.headers);
        if (data.session?.access_token) {
          headers.set("Authorization", `Bearer ${data.session.access_token}`);
        }
        return fetch(input, { ...init, headers });
      },
    }),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const isLoading = status === "submitted" || status === "streaming";

  const send = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    sendMessage({ text }, { body: { model } });
  };

  return (
    <div className="flex h-dvh min-w-0 flex-col overflow-hidden bg-background aria-code-theme font-mono text-foreground">
      {/* Terminal title bar */}
      <header className="flex items-center gap-3 border-b border-primary/15 bg-card px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-code-warning/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-primary/70" />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Code2 className="h-4 w-4 text-primary" />
          <span className="font-semibold tracking-wide text-primary">aria-code</span>
          <span className="hidden text-muted-foreground/40 lg:inline">— autonomous engineering session</span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost"
            onClick={() => { stop(); setMessages([]); setInput(""); }}
            aria-label="New session"
            title="New session"
            className="rounded-md p-2 text-muted-foreground/60 transition-colors hover:bg-primary/10 hover:text-primary"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Link
            to="/settings"
            title="Settings & connected tools"
            className="rounded-md p-2 text-muted-foreground/60 transition-colors hover:bg-primary/10 hover:text-primary"
          >
            <Settings className="h-4 w-4" />
          </Link>
          <Link
            to="/chat"
            title="Back to chat"
            className="rounded-md p-2 text-muted-foreground/60 transition-colors hover:bg-primary/10 hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* Model + quota strip */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-primary/15 bg-card px-4 py-3">
        <div className="flex max-w-full items-center gap-1 rounded-lg border border-primary/20 bg-background/30 p-1">
          {CODE_MODELS.map((m) => (
            <Button variant="ghost"
              key={m.id}
              onClick={() => setModel(m.id as CodeModelId)}
              className={cn(
                "rounded-md px-2 py-1.5 text-xs sm:px-3 transition-all",
                model === m.id
                  ? "bg-primary/15 text-primary ring-1 ring-primary/40"
                  : "text-muted-foreground/50 hover:text-muted-foreground",
              )}
              title={m.tagline}
            >
              <Cpu className="mr-1.5 inline h-3 w-3" />
              {m.label}
            </Button>
          ))}
        </div>
        <div className="grid w-full min-w-0 basis-full grid-cols-2 gap-x-6 gap-y-2 sm:max-w-md sm:basis-auto sm:flex-1">
          {usage ? (
            <>
              <QuotaBar
                label="today"
                used={usage.dayUsed}
                limit={usage.dayLimit}
                resetAt={usage.dayResetAt}
              />
              <QuotaBar
                label="this month"
                used={usage.monthUsed}
                limit={usage.monthLimit}
                resetAt={usage.monthResetAt}
              />
            </>
          ) : (
            <div className="col-span-2 h-8 animate-pulse rounded bg-primary/5" />
          )}
        </div>
      </div>

      {/* Transcript */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 && (
          <div className="mx-auto mt-16 max-w-xl text-center">
            <AriaLogo className="mx-auto h-14 w-14 opacity-90" />
            <h1 className="mt-4 text-lg font-semibold text-primary">
              Aria Code
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground/50">
              An autonomous engineering session. Aria searches the web, reads docs
              and uses your connected tools on its own — then writes complete,
              production-ready code.
            </p>
            <div className="mt-6 grid gap-2 text-left text-xs">
              {[
                "Build a rate limiter middleware for Express with sliding window",
                "Debug: why does my React useEffect fire twice in dev?",
                "Write a Postgres migration adding soft deletes to every table",
              ].map((s) => (
                <Button variant="ghost"
                  key={s}
                  onClick={() => {
                    setInput(s);
                    inputRef.current?.focus();
                  }}
                  className="flex h-auto items-center justify-start gap-2 whitespace-normal rounded-lg border border-primary/15 bg-primary/5 px-3 py-2.5 text-left text-muted-foreground/70 transition-colors hover:border-primary/40 hover:text-muted-foreground"
                >
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-primary" />
                  {s}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="mx-auto max-w-3xl space-y-6">
          {messages.map((m) => {
            if (m.role === "user") {
              const text = m.parts
                .map((p) => (p.type === "text" ? p.text : ""))
                .join("");
              return (
                <div key={m.id} className="flex gap-2 text-sm">
                  <span className="shrink-0 select-none text-primary">$</span>
                  <p className="min-w-0 whitespace-pre-wrap break-words text-foreground">{text}</p>
                </div>
              );
            }
            return (
              <div key={m.id} className="space-y-2">
                {m.parts.map((part, i) => {
                  if (part.type === "text") {
                    return (
                      <div
                        key={i}
                        className="prose min-w-0 break-words [&_pre]:overflow-x-auto [&_pre]:p-3 prose-invert prose-sm max-w-none prose-pre:border prose-pre:border-primary/20 prose-pre:bg-background/50 prose-code:text-primary"
                      >
                        <ReactMarkdown>{part.text}</ReactMarkdown>
                      </div>
                    );
                  }
                  if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
                    const toolName = part.type === "dynamic-tool" ? (part as { toolName?: string }).toolName ?? "tool" : part.type.slice(5);
                    const state = (part as { state?: string }).state;
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded-md border border-primary/15 bg-background/30 px-2.5 py-1.5 text-[11px] text-muted-foreground/60"
                      >
                        <Wrench className="h-3 w-3 text-primary" />
                        <span className="font-medium text-primary/90">{toolName}</span>
                        <span>
                          {state === "output-available" ? "done" : state === "output-error" ? "failed" : "running…"}
                        </span>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            );
          })}
          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground/50">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              aria-code is working…
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error.message || "Something went wrong. Try again."}
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-primary/15 bg-card px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-xl border border-primary/25 bg-background/40 px-3 py-2 focus-within:border-primary/50">
          <span className="select-none pb-1.5 text-sm text-primary">$</span>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            aria-label="Code task"
             rows={1}
            placeholder="describe the task — aria-code handles the rest"
            className="max-h-40 min-h-6 min-w-0 flex-1 resize-none bg-transparent pb-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/30"
            autoFocus
          />
          <Button variant="ghost"
            onClick={() => isLoading ? stop() : send()}
            disabled={!isLoading && !input.trim()}
            className="rounded-lg bg-primary/15 p-2 text-primary transition-colors hover:bg-primary/25 disabled:opacity-40"
            aria-label={isLoading ? "Stop generation" : "Send"}
          >
            {isLoading ? (
              <Square className="h-4 w-4" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="mx-auto mt-2 flex max-w-3xl items-center gap-1.5 text-[10px] text-muted-foreground/30">
          <Zap className="h-3 w-3" />
          Aria Code uses its own quota — separate from chat. Connect external tools in Settings.
        </p>
      </div>
    </div>
  );
}
