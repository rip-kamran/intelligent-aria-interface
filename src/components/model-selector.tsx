import { useState } from "react";
import { Check, ChevronDown, Lock, Sparkle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  MODEL_LIST,
  MODELS,
  canUseModel,
  type ModelId,
  type PlanId,
} from "@/lib/aria-prompts";

const GROUPS: { tier: PlanId; label: string }[] = [
  { tier: "free", label: "Included in your plan" },
  { tier: "pro", label: "Pro models" },
  { tier: "max", label: "Max — early access" },
];

export function ModelSelector({
  value,
  plan,
  onChange,
}: {
  value: ModelId;
  plan: PlanId;
  onChange: (m: ModelId) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = MODELS[value];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="group flex max-w-[60vw] items-center gap-2 rounded-xl border border-border/60 bg-card/60 px-3 py-1.5 text-left transition-colors hover:border-primary/50 hover:bg-card"
        aria-label="Choose Aria model"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium leading-tight">
            Aria {active.label}
          </span>
          <span className="hidden truncate text-[11px] leading-tight text-muted-foreground sm:block">
            {active.tagline}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(92vw,26rem)] max-h-[70vh] overflow-y-auto rounded-2xl border-border/60 bg-card/95 p-2 backdrop-blur-xl"
      >
        {GROUPS.map((g) => {
          const models = MODEL_LIST.filter((m) => m.tier === g.tier);
          if (models.length === 0) return null;
          return (
            <div key={g.tier} className="mb-1 last:mb-0">
              <p className="px-2.5 pb-1 pt-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {g.label}
              </p>
              {models.map((m) => {
                const locked = !canUseModel(plan, m.id);
                const selected = m.id === value;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      onChange(m.id);
                      if (!locked) setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors",
                      selected ? "bg-primary/10" : "hover:bg-accent",
                      locked && "opacity-60",
                    )}
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background/60">
                      {locked ? (
                        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <Sparkle className="h-3.5 w-3.5 text-primary" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">Aria {m.label}</span>
                        {m.earlyAccess && (
                          <span className="rounded-full border border-primary/40 px-1.5 py-px text-[9px] uppercase tracking-wide text-primary">
                            Preview
                          </span>
                        )}
                        {locked && (
                          <span className="rounded-full border border-border px-1.5 py-px text-[9px] uppercase tracking-wide text-muted-foreground">
                            {m.tier === "max" ? "Max" : "Pro"}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                        {m.tagline}
                      </span>
                    </span>
                    {selected && <Check className="mt-1 h-4 w-4 shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
