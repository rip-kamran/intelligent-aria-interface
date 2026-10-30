import { formatTokens } from "@/lib/aria-prompts";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { getUsage, type UsageSummary } from "@/lib/usage.functions";
import { PLANS, USAGE_WARN_AT } from "@/lib/aria-prompts";

export function useUsage() {
  const usageFn = useServerFn(getUsage);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const refresh = useCallback(() => {
    usageFn()
      .then((u) => setUsage(u as UsageSummary))
      .catch(() => {});
  }, [usageFn]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return { usage, refresh };
}

function formatCountdown(resetAt: string): string {
  const ms = new Date(resetAt).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "in a moment";
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.round((ms % 3_600_000) / 60_000);
  if (hours <= 0) return `in ${Math.max(1, minutes)}m`;
  return `in ${hours}h ${minutes}m`;
}

export function usagePercent(usage: UsageSummary | null): number {
  if (!usage || usage.limit <= 0 || usage.hasOwnKeys) return 0;
  return Math.min(100, Math.round((usage.used / usage.limit) * 100));
}

/** Dismissible banner shown once the user crosses 90% of their allowance. */
export function UsageWarning({
  usage,
  className,
}: {
  usage: UsageSummary | null;
  className?: string;
}) {
  const [dismissedAt, setDismissedAt] = useState<string | null>(null);
  const pct = usagePercent(usage);
  if (!usage || usage.hasOwnKeys || pct < USAGE_WARN_AT * 100) return null;
  if (dismissedAt === usage.resetAt) return null;

  const maxed = pct >= 100;
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-3.5 py-2.5 text-xs backdrop-blur",
        maxed
          ? "border-destructive/40 bg-destructive/10 text-destructive-foreground"
          : "border-amber-400/40 bg-amber-400/10",
        className,
      )}
      role="status"
    >
      <Zap className={cn("mt-0.5 h-4 w-4 shrink-0", maxed ? "text-destructive" : "text-amber-400")} />
      <p className="min-w-0 flex-1 leading-relaxed text-foreground/90">
        {maxed
          ? `You've used your full allowance. It resets ${formatCountdown(usage.resetAt)} — or add your own API key in Settings for unlimited use.`
          : `You've reached ${pct}% of your current allowance. It resets ${formatCountdown(usage.resetAt)}.`}
      </p>
      <button
        onClick={() => setDismissedAt(usage.resetAt)}
        aria-label="Dismiss usage notice"
        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function UsageMeter({
  usage,
  className,
  showUpgrade = true,
}: {
  usage: UsageSummary | null;
  className?: string;
  showUpgrade?: boolean;
}) {
  if (!usage) {
    return <div className={cn("h-14 animate-pulse rounded-xl bg-muted/40", className)} />;
  }
  const pct = usagePercent(usage);
  const left = Math.max(0, usage.limit - usage.used);
  const tone =
    pct >= 100 ? "bg-destructive" : pct >= USAGE_WARN_AT * 100 ? "bg-amber-400" : "bg-primary";

  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-card/50 px-3 py-2.5 backdrop-blur",
        className,
      )}
    >
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Zap className="h-3.5 w-3.5 text-primary" />
          Usage
        </span>
        <span className="tabular-nums text-foreground/80">{pct}%</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all duration-500", tone)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          {usage.hasOwnKeys
            ? "Your own API keys are unlimited"
            : left > 0
              ? `${formatTokens(left)} tokens left · resets ${formatCountdown(usage.resetAt)}`
              : `Allowance used — resets ${formatCountdown(usage.resetAt)}`}
        </span>
        {showUpgrade && (
          <Link to="/settings" className="text-primary hover:underline">
            {PLANS[usage.plan].name}
          </Link>
        )}
      </div>
    </div>
  );
}
