import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  resolveLimit,
  resolvePlan,
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
    const [{ data: profile }, { data: quota }, { data: keys }] = await Promise.all([
      context.supabase
        .from("profiles")
        .select("plan, plan_expires_at, message_limit_override")
        .eq("id", context.userId)
        .maybeSingle(),
      context.supabase.rpc("get_message_quota", { _window_hours: USAGE_WINDOW_HOURS }),
      context.supabase.from("user_api_keys").select("provider"),
    ]);
    const p = (profile ?? {}) as {
      plan?: string;
      plan_expires_at?: string | null;
      message_limit_override?: number | null;
    };
    const storedPlan = (p.plan ?? "free") as PlanId;
    const plan = resolvePlan(storedPlan, p.plan_expires_at ?? null);

    const row = (Array.isArray(quota) ? quota[0] : quota) as
      | { used: number; reset_at: string }
      | undefined;

    return {
      used: row?.used ?? 0,
      limit: resolveLimit(plan, p.message_limit_override ?? null),
      plan,
      storedPlan,
      hasOwnKeys: (keys ?? []).length > 0,
      resetAt:
        row?.reset_at ?? new Date(Date.now() + USAGE_WINDOW_HOURS * 3600_000).toISOString(),
    };
  });
