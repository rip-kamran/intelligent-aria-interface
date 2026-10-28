import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast, Toaster } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AriaLogo } from "@/components/aria-logo";
import { GoogleButton } from "@/components/google-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Aria" },
      { name: "description", content: "Sign in to Aria to save and sync your conversations." },
      { property: "og:title", content: "Sign in — Aria" },
{ property: "og:description", content: "Sign in to Aria to save and sync your conversations." },
{ property: "og:type", content: "website" },
{ name: "twitter:card", content: "summary" },
{ name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return;
      if (data.session.user.email_confirmed_at) {
        navigate({ to: "/chat", replace: true });
      } else {
        navigate({
          to: "/verify-email",
          search: { email: data.session.user.email },
          replace: true,
        });
      }
    });
  }, [navigate]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/chat` },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account.");
        navigate({ to: "/verify-email", search: { email } });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user?.email_confirmed_at) navigate({ to: "/chat" });
        else navigate({ to: "/verify-email", search: { email } });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-aria-hero px-6">
      <Toaster theme="dark" />
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <AriaLogo className="h-9 w-9" />
          <span className="font-display text-2xl italic">Aria</span>
        </Link>

        <div className="rounded-2xl border border-border/60 bg-card/50 p-6 backdrop-blur-xl">
          <h1 className="text-center text-xl font-medium">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "Sign in to continue" : "Start chatting with Aria"}
          </p>

          <div className="mt-6">
            <GoogleButton
              disabled={loading}
              onError={(m) => toast.error(m)}
              redirectPath="/chat"
            />
          </div>


          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border/60" /> or <span className="h-px flex-1 bg-border/60" />
          </div>

          <form onSubmit={handleEmail} className="space-y-3">
            <div>
              <Label htmlFor="email" className="text-xs text-muted-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-xs text-muted-foreground">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                className="mt-1"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full rounded-lg ring-glow">
              {loading ? "…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-5 w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            {mode === "signin" ? "No account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Aria was created by Kamran (Zaid Shaik).
        </p>
      </div>
    </div>
  );
}
