import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLAN_CREDIT_COST, PLAN_REDEEM_DAYS } from "@/lib/aria-prompts";

export type CreditEntry = {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
};

export type CreditsSummary = {
  credits: number;
  history: CreditEntry[];
};

export const getCredits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreditsSummary> => {
    const [{ data: profile }, { data: ledger }] = await Promise.all([
      context.supabase.from("profiles").select("credits").eq("id", context.userId).maybeSingle(),
      context.supabase
        .from("credit_ledger")
        .select("id, amount, reason, created_at")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    return {
      credits: ((profile ?? {}) as { credits?: number }).credits ?? 0,
      history: (ledger ?? []).map((e) => ({
        id: e.id as string,
        amount: e.amount as number,
        reason: e.reason as string,
        createdAt: e.created_at as string,
      })),
    };
  });

export const redeemPlanWithCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ plan: z.enum(["pro", "max"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("redeem_credits_for_plan", {
      _plan: data.plan,
      _days: PLAN_REDEEM_DAYS,
      _cost: PLAN_CREDIT_COST[data.plan],
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
