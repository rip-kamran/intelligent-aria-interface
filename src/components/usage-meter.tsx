import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { getUsage, type UsageSummary } from "@/lib/usage.functions";
import { PLANS } from "@/lib/aria-prompts";

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
  const pct = Math.min(100, Math.round((usage.used / usage.limit) * 100));
  const left = Math.max(0, usage.limit - usage.used);
  const tone =
    pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-amber-400" : "bg-primary";

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
          Daily usage
        </span>
        <span className="tabular-nums text-foreground/80">
          {usage.used.toLocaleString()} / {usage.limit.toLocaleString()}
        </span>
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
              ? `${left.toLocaleString()} messages left today`
              : "Daily limit reached — resets at midnight UTC"}
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
