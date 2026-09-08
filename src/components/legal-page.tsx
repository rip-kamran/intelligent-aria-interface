import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AriaLogo } from "@/components/aria-logo";
import { SiteFooter } from "@/components/site-footer";
import { LAST_UPDATED } from "@/lib/legal";

/** Shared shell for the Terms, Privacy and Cookies pages. */
export function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-aria-hero">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2.5">
          <AriaLogo className="h-8 w-8" />
          <span className="text-lg font-medium tracking-tight">Aria</span>
        </Link>
        <Link to="/" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
          Back home
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-6">
        <h1 className="font-display text-4xl italic md:text-5xl">{title}</h1>
        <p className="mt-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Last updated {LAST_UPDATED}
        </p>
        <p className="mt-6 text-base leading-relaxed text-muted-foreground">{intro}</p>
        <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted-foreground [&_a]:text-primary [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-medium [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
          {children}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
