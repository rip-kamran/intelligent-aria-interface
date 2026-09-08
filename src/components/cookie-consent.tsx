import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

const KEY = "aria.cookie-consent";

/** Slim cookie notice — Aria only sets essential cookies, so this is informational consent. */
export function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {
      /* storage blocked */
    }
  }, []);

  const decide = (value: "accepted" | "essential") => {
    try {
      localStorage.setItem(KEY, value);
    } catch {
      /* storage blocked */
    }
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 md:inset-x-auto md:right-5 md:bottom-5 md:max-w-sm">
      <div className="rounded-2xl border border-border/60 bg-card/95 p-5 shadow-xl backdrop-blur">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Aria uses essential cookies to keep you signed in and remember your settings. Read the{" "}
          <Link to="/cookies" className="text-primary hover:underline">
            cookie policy
          </Link>
          .
        </p>
        <div className="mt-4 flex gap-2">
          <Button size="sm" className="flex-1 rounded-full" onClick={() => decide("accepted")}>
            Got it
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full"
            onClick={() => decide("essential")}
          >
            Essential only
          </Button>
        </div>
      </div>
    </div>
  );
}
