import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PLAN = z.enum(["free", "pro", "max"]);

export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { isAdmin: data === true };
  });

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin, getStats } = await import("@/lib/admin.server");
    await assertAdmin(context.supabase as never, context.userId);
    return getStats();
  });

export const adminListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ search: z.string().max(120).default(""), limit: z.number().min(1).max(500).default(200) })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin, listUsers } = await import("@/lib/admin.server");
    await assertAdmin(context.supabase as never, context.userId);
    return listUsers(data.search, data.limit);
  });

export const adminListErrors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ limit: z.number().min(1).max(200).default(50) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin, listErrors } = await import("@/lib/admin.server");
    await assertAdmin(context.supabase as never, context.userId);
    return listErrors(data.limit);
  });

export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        plan: PLAN.optional(),
        planExpiresAt: z.string().nullable().optional(),
        limitOverride: z.number().int().min(0).max(1_000_000).nullable().optional(),
        adminNote: z.string().max(1000).nullable().optional(),
        resetUsage: z.boolean().optional(),
        makeAdmin: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin, updateUser } = await import("@/lib/admin.server");
    await assertAdmin(context.supabase as never, context.userId);
    if (data.makeAdmin === false && data.userId === context.userId) {
      throw new Error("You can't remove your own admin access.");
    }
    await updateUser(data);
    return { ok: true };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertAdmin, deleteUserAccount } = await import("@/lib/admin.server");
    await assertAdmin(context.supabase as never, context.userId);
    if (data.userId === context.userId) throw new Error("You can't delete your own account here.");
    await deleteUserAccount(data.userId);
    return { ok: true };
  });
