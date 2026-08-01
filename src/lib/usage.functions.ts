import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DAILY_LIMITS,
  effectivePlan,
  USAGE_ROW_KEY,
  USAGE_WINDOW_HOURS,
  type PlanId,
} from "@/lib/aria-prompts";

export type UsageSummary = {
  used: number;
  limit: number;
  plan: PlanId;
  storedPlan: PlanId;
  hasOwnKeys: boolean;
  /** ISO timestamp when the allowance rolls back to zero. */
  resetAt: string;
};

export const getUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UsageSummary> => {
    const [{ data: profile }, { data: usage }, { data: keys }] = await Promise.all([
      context.supabase.from("profiles").select("plan").eq("id", context.userId).maybeSingle(),
      context.supabase
        .from("usage_daily")
        .select("message_count, reset_at")
        .eq("user_id", context.userId)
        .eq("day", USAGE_ROW_KEY)
        .maybeSingle(),
      context.supabase.from("user_api_keys").select("provider"),
    ]);
    const storedPlan = (((profile as { plan?: string } | null)?.plan) ?? "free") as PlanId;
    const plan = effectivePlan(storedPlan);

    const now = Date.now();
    const storedReset = usage?.reset_at ? new Date(usage.reset_at as string).getTime() : 0;
    const expired = !usage || storedReset <= now;

    return {
      used: expired ? 0 : (usage?.message_count ?? 0),
      limit: DAILY_LIMITS[plan],
      plan,
      storedPlan,
      hasOwnKeys: (keys ?? []).length > 0,
      resetAt: new Date(
        expired ? now + USAGE_WINDOW_HOURS * 3600_000 : storedReset,
      ).toISOString(),
    };
  });
