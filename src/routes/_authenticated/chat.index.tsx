import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AriaLogo } from "@/components/aria-logo";
import { sendWelcomeEmail } from "@/lib/email.functions";

export const Route = createFileRoute("/_authenticated/chat/")({
  head: () => ({ meta: [{ title: "New chat — Aria" }, { name: "description", content: "Start a new conversation with Aria." },
{ property: "og:title", content: "New chat — Aria" },
{ property: "og:description", content: "Start a new conversation with Aria." },
{ property: "og:type", content: "website" },
{ name: "twitter:card", content: "summary" },
{ name: "robots", content: "noindex" }] }),
  component: ChatIndex,
});

function ChatIndex() {
  const navigate = useNavigate();
  useEffect(() => {
    void sendWelcomeEmail().catch(() => {});
    const id = crypto.randomUUID();
    navigate({ to: "/chat/$threadId", params: { threadId: id }, replace: true });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-aria-hero">
      <AriaLogo className="h-10 w-10 animate-pulse" />
    </div>
  );
}
