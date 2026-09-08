import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { AriaLogo } from "../components/aria-logo";
import { CONTACT_EMAIL } from "../lib/legal";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { BadgeBlocker } from "../components/badge-blocker";
import { CookieConsent } from "../components/cookie-consent";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-aria-hero px-6 text-center">
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
      </div>
      <a
        href={`mailto:${CONTACT_EMAIL}`}
        className="mt-8 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        Something broken? {CONTACT_EMAIL}
      </a>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "author", content: "Kamran (Zaid Shaik)" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png?v=aria", type: "image/png" },
      { rel: "shortcut icon", href: "/favicon.png?v=aria", type: "image/png" },
      { rel: "apple-touch-icon", href: "/favicon.png?v=aria" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <BadgeBlocker />
      <CookieConsent />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}

