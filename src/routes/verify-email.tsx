import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast, Toaster } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AriaLogo } from "@/components/aria-logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/verify-email")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { email?: string } =>
    typeof search['email'] === "string" ? { email: search['email'] as string } : {},
  head: () => ({
    meta: [
      { title: "Verify your email — Aria" },
      {
        name: "description",
        content: "Confirm your email address to unlock your Aria conversations.",
      },
      { property: "og:title", content: "Verify your email — Aria" },
{ property: "og:description", content: "Confirm your email address to unlock your Aria conversations." },
{ property: "og:type", content: "website" },
{ name: "twitter:card", content: "summary" },
{ name: "robots", content: "noindex" },
    ],
  }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const navigate = useNavigate();
  const { email: pendingEmail } = Route.useSearch();
  const [email, setEmail] = useState<string | null>(pendingEmail ?? null);
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let active = true;
    const check = async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      if (!data.user) {
        // Sign-up with email confirmation returns no session, so keep showing
        // this screen when we know which address is pending.
        if (!pendingEmail) navigate({ to: "/auth", replace: true });
        return;
      }
      setEmail(data.user.email ?? null);
      if (data.user.email_confirmed_at) navigate({ to: "/chat", replace: true });
    };
    void check();
    const timer = setInterval(check, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [navigate, pendingEmail]);

  const resend = async () => {
    if (!email) return;
    setSending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/chat` },
    });
    setSending(false);
    if (error) toast.error(error.message);
    else toast.success("Verification email sent.");
  };

  const refresh = async () => {
    setChecking(true);
    const { data } = await supabase.auth.refreshSession();
    setChecking(false);
    if (data.user?.email_confirmed_at) navigate({ to: "/chat", replace: true });
    else toast.error("Not verified yet — check your inbox.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-aria-hero px-6">
      <Toaster theme="dark" />
      <div className="w-full max-w-sm text-center">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <AriaLogo className="h-9 w-9" />
          <span className="font-display text-2xl italic">Aria</span>
        </Link>
        <div className="rounded-2xl border border-border/60 bg-card/50 p-6 backdrop-blur-xl">
          <h1 className="text-xl font-medium">Verify your email</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a confirmation link to{" "}
            <span className="text-foreground">{email ?? "your inbox"}</span>. Confirm it to start
            chatting with Aria.
          </p>
          <div className="mt-6 space-y-3">
            <Button onClick={refresh} disabled={checking} className="w-full rounded-lg ring-glow">
              {checking ? "Checking…" : "I've verified — continue"}
            </Button>
            <Button
              onClick={resend}
              disabled={sending || !email}
              variant="secondary"
              className="w-full rounded-lg"
            >
              {sending ? "Sending…" : "Resend email"}
            </Button>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/auth", replace: true });
              }}
              className="w-full text-xs text-muted-foreground hover:text-foreground"
            >
              Use a different account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
