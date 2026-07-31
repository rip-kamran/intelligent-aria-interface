import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DAILY_LIMITS, effectivePlan, type PlanId } from "@/lib/aria-prompts";

export type UsageSummary = {
  used: number;
  limit: number;
  plan: PlanId;
  storedPlan: PlanId;
  hasOwnKeys: boolean;
};

export const getUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UsageSummary> => {
    const day = new Date().toISOString().slice(0, 10);
    const [{ data: profile }, { data: usage }, { data: keys }] = await Promise.all([
      context.supabase.from("profiles").select("plan").eq("id", context.userId).maybeSingle(),
      context.supabase
        .from("usage_daily")
        .select("message_count")
        .eq("user_id", context.userId)
        .eq("day", day)
        .maybeSingle(),
      context.supabase.from("user_api_keys").select("provider"),
    ]);
    const storedPlan = (((profile as { plan?: string } | null)?.plan) ?? "free") as PlanId;
    const plan = effectivePlan(storedPlan);
    return {
      used: usage?.message_count ?? 0,
      limit: DAILY_LIMITS[plan],
      plan,
      storedPlan,
      hasOwnKeys: (keys ?? []).length > 0,
    };
  });
