import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  MODEL_IDS,
  EFFICIENCY_IDS,
  canUseModel,
  type ModelId,
  type PlanId,
} from "@/lib/aria-prompts";

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select(
        "display_name, custom_instructions, preferred_model, plan, memory_enabled, web_search_enabled, response_style, response_length, efficiency",
      )
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (
      data ?? {
        display_name: null,
        custom_instructions: null,
        preferred_model: "prose",
        plan: "free",
        memory_enabled: true,
        web_search_enabled: true,
        response_style: "default",
        response_length: "balanced",
        efficiency: "mid",
      }
    );
  });

export const RESPONSE_STYLES = [
  "default",
  "friendly",
  "concise",
  "professional",
  "technical",
  "socratic",
] as const;
export const RESPONSE_LENGTHS = ["short", "balanced", "detailed"] as const;

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        display_name: z.string().max(80).nullable().optional(),
        custom_instructions: z.string().max(4000).nullable().optional(),
        preferred_model: z.enum(MODEL_IDS).optional(),
        memory_enabled: z.boolean().optional(),
        web_search_enabled: z.boolean().optional(),
        response_style: z.enum(RESPONSE_STYLES).optional(),
        response_length: z.enum(RESPONSE_LENGTHS).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.preferred_model) {
      const { data: prof } = await context.supabase
        .from("profiles")
        .select("plan")
        .eq("id", context.userId)
        .maybeSingle();
      const plan = ((prof as { plan?: string } | null)?.plan ?? "free") as PlanId;
      if (!canUseModel(plan, data.preferred_model as ModelId)) {
        throw new Error("That model requires an upgraded plan.");
      }
    }
    const { error } = await context.supabase
      .from("profiles")
      .upsert({ id: context.userId, ...data });
    if (error) throw new Error(error.message);
    return { ok: true };
  });



export const listApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_api_keys")
      .select("provider, api_key");
    if (error) throw new Error(error.message);
    // Mask keys for display: keep first 4 + last 4.
    return (data ?? []).map((r) => ({
      provider: r.provider as string,
      masked:
        r.api_key.length > 12
          ? `${r.api_key.slice(0, 4)}…${r.api_key.slice(-4)}`
          : "••••",
      hasKey: true,
    }));
  });

export const saveApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ provider: z.string().min(1), api_key: z.string().min(4) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_api_keys")
      .upsert(
        {
          user_id: context.userId,
          provider: data.provider,
          api_key: data.api_key.trim(),
        },
        { onConflict: "user_id,provider" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ provider: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_api_keys")
      .delete()
      .eq("provider", data.provider);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
