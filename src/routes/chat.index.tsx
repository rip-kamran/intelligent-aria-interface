import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/use-auth";
import { isFirebaseConfigured } from "@/lib/firebase";
import { AriaLogo } from "@/components/aria-logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/chat/")({
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
  const { user, loading, signInGoogle } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      const id = crypto.randomUUID();
      navigate({ to: "/chat/$threadId", params: { threadId: id }, replace: true });
    }
  }, [user, loading, navigate]);

  if (!isFirebaseConfigured) {
    return <SetupNeeded />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-aria-hero px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card/60 p-8 text-center backdrop-blur">
        <AriaLogo className="mx-auto h-12 w-12" />
        <h1 className="mt-5 font-display text-3xl italic">Welcome to Aria</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to start a conversation. Your chats sync across every device you use.
        </p>
        <Button
          className="mt-6 w-full rounded-full"
          size="lg"
          disabled={loading}
          onClick={() => signInGoogle().catch(console.error)}
        >
          Continue with Google
        </Button>
      </div>
    </div>
  );
}

function SetupNeeded() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-aria-hero px-4">
      <div className="max-w-lg rounded-2xl border border-border/60 bg-card/60 p-8 backdrop-blur">
        <AriaLogo className="h-10 w-10" />
        <h1 className="mt-4 font-display text-2xl italic">Firebase not configured yet</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Open{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">src/lib/firebase.ts</code>{" "}
          and paste your Firebase web app config (apiKey, authDomain, projectId, appId). Then enable
          Google sign-in and create a Firestore database in the Firebase Console.
        </p>
      </div>
    </div>
  );
}
