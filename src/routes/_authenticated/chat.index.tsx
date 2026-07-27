import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AriaLogo } from "@/components/aria-logo";

export const Route = createFileRoute("/_authenticated/chat/")({
  head: () => ({
    meta: [
      { title: "Chat with Aria" },
      { name: "description", content: "Talk to Aria — your intelligent AI companion." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ChatIndex,
});

function ChatIndex() {
  const navigate = useNavigate();

  useEffect(() => {
    const id = crypto.randomUUID();
    navigate({ to: "/chat/$threadId", params: { threadId: id }, replace: true });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-aria-hero">
      <AriaLogo className="h-10 w-10 animate-pulse" />
    </div>
  );
}
