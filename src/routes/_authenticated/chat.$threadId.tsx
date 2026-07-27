import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import { Plus, Send, LogOut, Trash2, Menu, X } from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { isFirebaseConfigured } from "@/lib/firebase";
import {
  createThread,
  deleteThread,
  loadMessages,
  renameThread,
  saveMessage,
  subscribeThreads,
  type Thread,
} from "@/lib/threads";
import { AriaLogo } from "@/components/aria-logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/chat/$threadId")({
  head: () => ({
    meta: [
      { title: "Chat with Aria" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ChatThread,
});

function ChatThread() {
  const { threadId } = useParams({ from: "/chat/$threadId" });
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user && isFirebaseConfigured) {
      navigate({ to: "/chat", replace: true });
    }
  }, [loading, user, navigate]);

  if (!isFirebaseConfigured || loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-aria-hero">
        <AriaLogo className="h-10 w-10 animate-pulse" />
      </div>
    );
  }

  return <ChatShell key={threadId} threadId={threadId} uid={user.uid} onSignOut={signOut} />;
}

function ChatShell({
  threadId,
  uid,
  onSignOut,
}: {
  threadId: string;
  uid: string;
  onSignOut: () => Promise<void>;
}) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [initial, setInitial] = useState<UIMessage[] | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => subscribeThreads(uid, setThreads), [uid]);

  useEffect(() => {
    let cancelled = false;
    setInitial(null);
    loadMessages(uid, threadId).then((msgs) => {
      if (!cancelled) setInitial(msgs);
    });
    return () => {
      cancelled = true;
    };
  }, [uid, threadId]);

  const newChat = () => {
    const id = crypto.randomUUID();
    navigate({ to: "/chat/$threadId", params: { threadId: id } });
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Sidebar */}
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

        <div className="px-3">
          <Button onClick={newChat} className="w-full justify-start rounded-lg" variant="secondary">
            <Plus className="mr-2 h-4 w-4" />
            New chat
          </Button>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto px-2 pb-2">
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
                  onClick={async (e) => {
                    e.stopPropagation();
                    await deleteThread(uid, t.id);
                    if (t.id === threadId) newChat();
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

        <div className="border-t border-border/60 p-3">
          <button
            onClick={() => onSignOut()}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/60 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main */}
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
            <span className="text-sm font-medium">Aria</span>
          </div>
          <div className="w-8" />
        </header>

        {initial === null ? (
          <div className="flex flex-1 items-center justify-center">
            <AriaLogo className="h-8 w-8 animate-pulse" />
          </div>
        ) : (
          <ChatConversation uid={uid} threadId={threadId} initialMessages={initial} />
        )}
      </main>
    </div>
  );
}

function ChatConversation({
  uid,
  threadId,
  initialMessages,
}: {
  uid: string;
  threadId: string;
  initialMessages: UIMessage[];
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const persistedIds = useRef(new Set(initialMessages.map((m) => m.id)));
  const threadCreated = useRef(initialMessages.length > 0);

  const { messages, sendMessage, status, error } = useChat({
    id: threadId,
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  // Autoscroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  // Focus input on load, thread switch, and after streaming
  useEffect(() => {
    inputRef.current?.focus();
  }, [threadId, status === "ready"]);

  // Persist finished messages
  useEffect(() => {
    if (status === "streaming" || status === "submitted") return;
    (async () => {
      for (const m of messages) {
        if (!persistedIds.current.has(m.id)) {
          if (!threadCreated.current) {
            const title = extractText(messages[0]).slice(0, 60) || "New chat";
            await createThread(uid, threadId, title);
            threadCreated.current = true;
          }
          await saveMessage(uid, threadId, m);
          persistedIds.current.add(m.id);
        }
      }
      // Rename thread after first assistant reply if title is still generic
      if (threadCreated.current && messages.length >= 2) {
        const first = extractText(messages[0]);
        if (first) await renameThread(uid, threadId, first.slice(0, 60));
      }
    })().catch(console.error);
  }, [messages, status, uid, threadId]);

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
                Something went wrong. Please try again.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Composer */}
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
              style={{
                height: "auto",
              }}
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
