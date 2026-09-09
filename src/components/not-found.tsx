import { Link } from "@tanstack/react-router";
import { AriaLogo } from "@/components/aria-logo";
import { SiteFooter } from "@/components/site-footer";

/** The real 404 page used for every unmatched route. */
export function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-aria-hero">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2.5">
          <AriaLogo className="h-8 w-8" />
          <span className="text-lg font-medium tracking-tight">Aria</span>
        </Link>
        <Link to="/contact" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
          Contact
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <AriaLogo className="h-12 w-12" />
        <p className="mt-8 font-display text-7xl italic text-gradient-aria md:text-8xl">404</p>
        <h1 className="mt-4 text-xl font-medium text-foreground">This page drifted off</h1>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
          The page you're looking for doesn't exist, or it moved somewhere else. Aria is still right
          here whenever you need her.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Go home
          </Link>
          <Link
            to="/chat"
            className="inline-flex h-11 items-center justify-center rounded-full border border-border/60 px-6 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Open Aria
          </Link>
          <Link
            to="/contact"
            className="inline-flex h-11 items-center justify-center rounded-full border border-border/60 px-6 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Contact us
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
