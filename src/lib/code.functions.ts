import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { codeLimits, resolvePlan, type PlanId } from "@/lib/aria-prompts";

export type CodeUsageSummary = {
  plan: PlanId;
  dayUsed: number;
  dayLimit: number;
  dayResetAt: string;
  monthUsed: number;
  monthLimit: number;
  monthResetAt: string;
};

/** Aria Code quota for the signed-in user (separate from chat usage). */
export const getCodeUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CodeUsageSummary> => {
    const [{ data: profile }, { data: row }] = await Promise.all([
      context.supabase
        .from("profiles")
        .select("plan, plan_expires_at")
        .eq("id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("code_usage")
        .select("day_used, day_reset_at, month_used, month_reset_at")
        .eq("user_id", context.userId)
        .maybeSingle(),
    ]);
    const prof = (profile ?? {}) as { plan?: string; plan_expires_at?: string | null };
    const plan = resolvePlan((prof.plan ?? "free") as PlanId, prof.plan_expires_at ?? null);
    const limits = codeLimits(plan);
    return {
      plan,
      dayUsed: row?.day_used ?? 0,
      dayLimit: limits.day,
      dayResetAt: row?.day_reset_at ?? new Date(Date.now() + 86_400_000).toISOString(),
      monthUsed: row?.month_used ?? 0,
      monthLimit: limits.month,
      monthResetAt: row?.month_reset_at ?? new Date(Date.now() + 30 * 86_400_000).toISOString(),
    };
  });
