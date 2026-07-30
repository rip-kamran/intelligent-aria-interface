import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import { Plus, Send, LogOut, Trash2, Menu, X, Search, Download, Settings } from "lucide-react";
import { toast, Toaster } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { AriaLogo } from "@/components/aria-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MODEL_LIST, MODELS, canUseModel, type ModelId, type PlanId } from "@/lib/aria-prompts";
import { getProfile } from "@/lib/settings.functions";

import {
  listThreads,
  getThread,
  deleteThreadFn,
  updateThreadModel,
  searchThreads,
} from "@/lib/threads.functions";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  head: () => ({
    meta: [
      { title: "Chat with Aria" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ChatThread,
});

type ThreadRow = { id: string; title: string; model: string; updated_at: string };

function ChatThread() {
  const { threadId } = useParams({ from: "/_authenticated/chat/$threadId" });
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const listFn = useServerFn(listThreads);
  const getFn = useServerFn(getThread);
  const delFn = useServerFn(deleteThreadFn);
  const setModelFn = useServerFn(updateThreadModel);
  const searchFn = useServerFn(searchThreads);
  const profileFn = useServerFn(getProfile);

  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [initial, setInitial] = useState<UIMessage[] | null>(null);
  const [threadModel, setThreadModel] = useState<ModelId>("prose");
  const [plan, setPlan] = useState<PlanId>("free");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    profileFn()
      .then((p) => setPlan(((p as { plan?: string }).plan ?? "free") as PlanId))
      .catch(() => {});
  }, [profileFn]);

  const refreshThreads = () => listFn().then((r) => setThreads(r as ThreadRow[])).catch(() => {});


  useEffect(() => {
    refreshThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  useEffect(() => {
    let cancelled = false;
    setInitial(null);
    getFn({ data: { threadId } })
      .then((r: Awaited<ReturnType<typeof getThread>>) => {
        if (cancelled) return;
        const msgs: UIMessage[] = r.messages.map((m) => ({
          id: m.id,
          role: m.role as UIMessage["role"],
          parts: m.parts as UIMessage["parts"],
        }));
        setInitial(msgs);
        if (r.thread?.model) setThreadModel(r.thread.model as ModelId);
      })
      .catch(() => setInitial([]));
    return () => {
      cancelled = true;
    };
  }, [threadId, getFn]);

  const newChat = () => {
    const id = crypto.randomUUID();
    navigate({ to: "/chat/$threadId", params: { threadId: id } });
    setSidebarOpen(false);
  };

  const handleDelete = async (id: string) => {
    await delFn({ data: { threadId: id } });
    await refreshThreads();
    if (id === threadId) newChat();
  };

  const changeModel = async (m: ModelId) => {
    setThreadModel(m);
    try {
      await setModelFn({ data: { threadId, model: m } });
    } catch {
      /* thread may not exist yet; will be set on first send */
    }
  };

  const runSearch = async () => {
    const q = query.trim();
    if (!q) {
      refreshThreads();
      return;
    }
    const r = await searchFn({ data: { q } });
    setThreads(r as ThreadRow[]);
  };

  if (!user) return null;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Toaster theme="dark" />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border/60 bg-card/70 backdrop-blur-xl transition-transform md:relative md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <AriaLogo className="h-6 w-6" />
            <span className="font-medium tracking-tight">Aria</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent md:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2 px-3">
          <Button onClick={newChat} className="w-full justify-start rounded-lg" variant="secondary">
            <Plus className="mr-2 h-4 w-4" /> New chat
          </Button>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="Search chats…"
              className="h-9 pl-8 text-sm"
            />
          </div>
        </div>

        <div className="mt-3 flex-1 overflow-y-auto px-2 pb-2">
          <p className="px-2 py-1.5 text-xs text-muted-foreground">Recent</p>
          <ul className="space-y-0.5">
            {threads.map((t) => (
              <li key={t.id} className="group relative">
                <button
                  onClick={() => {
                    navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
                    setSidebarOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-foreground/80 transition-colors hover:bg-accent",
                    t.id === threadId && "bg-accent text-foreground",
                  )}
                >
                  <span className="truncate pr-6">{t.title || "New chat"}</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(t.id);
                  }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-destructive group-hover:opacity-100"
                  aria-label="Delete chat"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
            {threads.length === 0 && (
              <li className="px-3 py-2 text-xs text-muted-foreground">No conversations yet.</li>
            )}
          </ul>
        </div>

        <div className="space-y-1 border-t border-border/60 p-3">
          <Link
            to="/settings"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Settings className="h-4 w-4" /> Settings
          </Link>
          <button
            onClick={() => signOut()}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/60 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border/60 px-4 py-3 md:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-2 text-muted-foreground hover:bg-accent md:hidden"
            aria-label="Open sidebar"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <AriaLogo className="h-5 w-5" />
            <select
              value={threadModel}
              onChange={(e) => changeModel(e.target.value as ModelId)}
              className="rounded-md border border-border/60 bg-card/60 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {MODEL_LIST.map((m) => (
                <option key={m.id} value={m.id}>
                  Aria {m.label}
                </option>
              ))}
            </select>
          </div>
          <ExportButton messages={initial ?? []} title={threads.find((t) => t.id === threadId)?.title || "chat"} />
        </header>

        {initial === null ? (
          <div className="flex flex-1 items-center justify-center">
            <AriaLogo className="h-8 w-8 animate-pulse" />
          </div>
        ) : (
          <ChatConversation
            threadId={threadId}
            model={threadModel}
            initialMessages={initial}
            onFirstMessage={refreshThreads}
          />
        )}
      </main>
    </div>
  );
}

function ExportButton({ messages, title }: { messages: UIMessage[]; title: string }) {
  const doExport = () => {
    if (messages.length === 0) {
      toast("Nothing to export yet.");
      return;
    }
    const md = messages
      .map((m) => {
        const text = m.parts
          .map((p) => (p.type === "text" ? p.text : ""))
          .join("")
          .trim();
        return `### ${m.role === "user" ? "You" : "Aria"}\n\n${text}\n`;
      })
      .join("\n---\n\n");
    const blob = new Blob([`# ${title}\n\n${md}`], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button
      onClick={doExport}
      className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
      aria-label="Export chat"
      title="Export chat as Markdown"
    >
      <Download className="h-4 w-4" />
    </button>
  );
}

function ChatConversation({
  threadId,
  model,
  initialMessages,
  onFirstMessage,
}: {
  threadId: string;
  model: ModelId;
  initialMessages: UIMessage[];
  onFirstMessage: () => void;
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const wasFirst = useRef(initialMessages.length === 0);

  const { messages, sendMessage, status, error } = useChat({
    id: threadId,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { threadId, model },
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

  useEffect(() => {
    inputRef.current?.focus();
  }, [threadId, status === "ready"]);

  useEffect(() => {
    if (status === "ready" && wasFirst.current && messages.length > 0) {
      wasFirst.current = false;
      onFirstMessage();
    }
  }, [status, messages, onFirstMessage]);

  const isLoading = status === "submitted" || status === "streaming";
  const submit = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    await sendMessage({ text });
  };
  const isEmpty = messages.length === 0;

  return (
    <>
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <AriaLogo className="h-14 w-14" />
            <h2 className="mt-6 font-display text-4xl italic">How can I help you today?</h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Ask anything — Aria is here to think it through with you.
            </p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 md:px-8">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {status === "submitted" && (
              <div className="flex items-center gap-3 pl-1 text-sm text-muted-foreground">
                <AriaLogo className="h-6 w-6" />
                <span className="inline-flex gap-1">
                  <Dot delay={0} />
                  <Dot delay={150} />
                  <Dot delay={300} />
                </span>
              </div>
            )}
            {error && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive-foreground">
                {error.message || "Something went wrong."}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-4 md:px-8">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="relative flex items-end gap-2 rounded-2xl border border-border/70 bg-card/60 p-2 pl-4 transition-colors focus-within:border-primary/60 focus-within:ring-glow"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={1}
              placeholder="Message Aria…"
              className="max-h-40 min-h-[36px] flex-1 resize-none bg-transparent py-2 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
              autoFocus
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
              className="h-9 w-9 shrink-0 rounded-xl"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Aria may make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </>
  );
}

function extractText(m: UIMessage): string {
  return m.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("")
    .trim();
}

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const text = extractText(message);
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-user-bubble px-4 py-2.5 text-[15px] leading-relaxed text-user-bubble-foreground">
          {text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <AriaLogo className="mt-1 h-6 w-6 shrink-0" />
      <div className="prose prose-invert prose-sm min-w-0 max-w-none flex-1 text-[15px] leading-relaxed [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3">
        <ReactMarkdown>{text || "…"}</ReactMarkdown>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}
