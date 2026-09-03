import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Sparkles, Shield, Zap, Check } from "lucide-react";
import { AriaLogo } from "@/components/aria-logo";
import { Button } from "@/components/ui/button";
import { PLAN_LIST, PLANS } from "@/lib/aria-prompts";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aria — Your Intelligent AI Companion" },
      {
        name: "description",
        content:
          "Meet Aria — an advanced AI assistant created by Kamran (Zaid Shaik). Calm, capable, and always by your side.",
      },
      { property: "og:title", content: "Aria — Your Intelligent AI Companion" },
      {
        property: "og:description",
        content: "An advanced AI assistant by Kamran (Zaid Shaik).",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active || !data.session) return;
      if (data.session.user.email_confirmed_at) navigate({ to: "/chat", replace: true });
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-aria-hero">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <AriaLogo className="h-8 w-8" />
          <span className="text-lg font-medium tracking-tight">Aria</span>
        </div>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#about" className="transition-colors hover:text-foreground">
            About
          </a>
          <a href="#pricing" className="transition-colors hover:text-foreground">
            Pricing
          </a>

          <a href="#creator" className="transition-colors hover:text-foreground">
            Creator
          </a>
        </nav>
        <Button asChild size="sm" className="rounded-full">
          <Link to="/chat">
            Open Aria <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pb-24 pt-20 text-center md:pt-32">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3.5 py-1.5 text-xs text-muted-foreground backdrop-blur">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
          </span>
          Introducing Aria Fable
        </div>

        <h1 className="font-display text-5xl leading-[1.05] tracking-tight md:text-7xl lg:text-8xl">
          Meet <span className="text-gradient-aria italic">Aria.</span>
          <br />
          Your intelligent
          <br />
          AI companion.
        </h1>

        <p className="mx-auto mt-8 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
          Aria is a calm, capable assistant built to think alongside you — writing, reasoning,
          coding, and answering the questions that matter.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="h-12 rounded-full px-7 text-base ring-glow">
            <Link to="/chat">
              Chat with Aria <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="lg" className="h-12 rounded-full px-6 text-base">
            <a href="#about">Learn more</a>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section id="about" className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              icon: Sparkles,
              title: "Genuinely thoughtful",
              body: "Warm, precise, and honest. Aria helps you think — it doesn't just autocomplete.",
            },
            {
              icon: Zap,
              title: "Fast and fluent",
              body: "Streaming responses, elegant formatting, and clean markdown for anything you write.",
            },
            {
              icon: Shield,
              title: "Yours alone",
              body: "Every conversation lives under your account. Sign in and pick up where you left off.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur transition-colors hover:border-primary/40"
            >
              <f.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-4 text-lg font-medium">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 pb-28">
        <div className="mb-12 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3.5 py-1 text-[11px] uppercase tracking-[0.16em] text-primary">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            Future upcoming update
          </span>
          <p className="mt-4 text-xs uppercase tracking-[0.2em] text-muted-foreground">Plans</p>
          <h2 className="mt-3 font-display text-4xl italic md:text-5xl">
            Start free. <span className="text-gradient-aria">Grow with Aria.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground">
            Paid plans aren't live yet — everyone is on Free while billing is being built. These
            are a preview of what's coming.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {PLAN_LIST.map((p) => (
            <div
              key={p.id}
              className={`relative flex flex-col rounded-2xl border p-7 backdrop-blur ${
                p.highlight
                  ? "border-primary/50 bg-card/60 ring-glow"
                  : "border-border/60 bg-card/40"
              }`}
            >
              <span className="absolute right-6 top-6 rounded-full border border-border/70 px-2.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                {p.id === "free" ? "Live now" : "Coming soon"}
              </span>
              <h3 className="text-lg font-medium">{p.name}</h3>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-display text-4xl">{p.price}</span>
                <span className="text-xs text-muted-foreground">{p.period}</span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{p.blurb}</p>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm text-muted-foreground">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {p.id === "free" ? (
                <Button asChild className="mt-7 h-11 rounded-full">
                  <Link to="/chat">Start free</Link>
                </Button>
              ) : (
                <Button
                  disabled
                  variant="secondary"
                  className="mt-7 h-11 rounded-full opacity-70"
                >
                  {p.name} — coming soon
                </Button>
              )}
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Every account is on Free today, with {PLANS.free.dailyMessages} messages a day. Pro and
          Max — and the models they unlock — arrive once billing goes live.
        </p>
      </section>

      {/* Creator */}

      <section id="creator" className="mx-auto max-w-3xl px-6 pb-32 text-center">
        <div className="rounded-3xl border border-border/60 bg-card/40 p-10 backdrop-blur md:p-14">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Created by</p>
          <h2 className="mt-3 font-display text-4xl italic md:text-5xl">
            Kamran <span className="text-muted-foreground not-italic">·</span>{" "}
            <span className="text-gradient-aria">Zaid Shaik</span>
          </h2>
          <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">
            Aria was designed and built by Kamran (also known as Zaid Shaik) as a personal,
            trustworthy AI companion — intelligent, calm, and quietly powerful.
          </p>
        </div>
      </section>

      <footer className="border-t border-border/40 py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Aria — by Kamran (Zaid Shaik)
      </footer>
    </div>
  );
}
