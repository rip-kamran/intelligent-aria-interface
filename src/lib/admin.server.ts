// Server-only helpers for the admin panel. Everything here runs with the
// service role and MUST only be reached after the caller's admin role has been
// verified against the database (never from client-supplied data).
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveLimit, resolvePlan, type PlanId } from "@/lib/aria-prompts";

export async function assertAdmin(
  userClient: SupabaseClient<never>,
  userId: string,
): Promise<void> {
  const { data, error } = await (userClient as never as SupabaseClient).rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error || data !== true) throw new Error("Forbidden");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type AdminUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  plan: PlanId;
  effectivePlan: PlanId;
  planExpiresAt: string | null;
  limitOverride: number | null;
  limit: number;
  used: number;
  resetAt: string | null;
  isAdmin: boolean;
  adminNote: string | null;
  createdAt: string | null;
  lastSeenAt: string | null;
  threads: number;
  messages: number;
};

export async function listUsers(search: string, limit: number): Promise<AdminUser[]> {
  const db = await admin();
  const { data: authUsers, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(error.message);

  const [{ data: profiles }, { data: usage }, { data: roles }, { data: threads }, { data: messages }] =
    await Promise.all([
      db.from("profiles").select("*"),
      db.from("usage_daily").select("user_id, message_count, reset_at"),
      db.from("user_roles").select("user_id, role"),
      db.from("threads").select("user_id"),
      db.from("messages").select("user_id"),
    ]);

  const profileBy = new Map((profiles ?? []).map((p) => [p.id as string, p]));
  const usageBy = new Map((usage ?? []).map((u) => [u.user_id as string, u]));
  const adminIds = new Set(
    (roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id as string),
  );
  const count = (rows: { user_id: string }[] | null, id: string) =>
    (rows ?? []).filter((r) => r.user_id === id).length;

  const q = search.trim().toLowerCase();
  const rows: AdminUser[] = authUsers.users.map((u) => {
    const p = (profileBy.get(u.id) ?? {}) as Record<string, unknown>;
    const usageRow = usageBy.get(u.id) as { message_count?: number; reset_at?: string } | undefined;
    const stored = ((p['plan'] as string) ?? "free") as PlanId;
    const eff = resolvePlan(stored, (p['plan_expires_at'] as string) ?? null);
    const override = (p['message_limit_override'] as number | null) ?? null;
    return {
      id: u.id,
      email: u.email ?? null,
      displayName: (p['display_name'] as string) ?? null,
      plan: stored,
      effectivePlan: eff,
      planExpiresAt: (p['plan_expires_at'] as string) ?? null,
      limitOverride: override,
      limit: resolveLimit(eff, override),
      used: usageRow?.message_count ?? 0,
      resetAt: usageRow?.reset_at ?? null,
      isAdmin: adminIds.has(u.id),
      adminNote: (p['admin_note'] as string) ?? null,
      createdAt: u.created_at ?? null,
      lastSeenAt: u.last_sign_in_at ?? (p['last_seen_at'] as string) ?? null,
      threads: count(threads as { user_id: string }[] | null, u.id),
      messages: count(messages as { user_id: string }[] | null, u.id),
    };
  });

  const filtered = q
    ? rows.filter(
        (r) =>
          (r.email ?? "").toLowerCase().includes(q) ||
          (r.displayName ?? "").toLowerCase().includes(q) ||
          r.id.includes(q),
      )
    : rows;

  return filtered
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .slice(0, limit);
}

const PLAN_PRICE: Record<PlanId, number> = { free: 0, pro: 15, max: 90 };

export type AdminStats = {
  totalUsers: number;
  activeToday: number;
  activeWeek: number;
  newThisMonth: number;
  messagesToday: number;
  messagesTotal: number;
  threadsTotal: number;
  errorsToday: number;
  errorsMonth: number;
  mrr: number;
  monthEarnings: number;
  paymentsLive: boolean;
  planCounts: Record<PlanId, number>;
  signupsByDay: { day: string; count: number }[];
};

export async function getStats(): Promise<AdminStats> {
  const db = await admin();
  const now = Date.now();
  const dayAgo = new Date(now - 86_400_000).toISOString();
  const weekAgo = new Date(now - 7 * 86_400_000).toISOString();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const { data: authUsers } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const users = authUsers?.users ?? [];

  const [{ data: profiles }, { count: messagesTotal }, { count: threadsTotal }, { data: recentMsgs }, { count: errorsToday }, { count: errorsMonth }] =
    await Promise.all([
      db.from("profiles").select("plan, plan_expires_at"),
      db.from("messages").select("id", { count: "exact", head: true }),
      db.from("threads").select("id", { count: "exact", head: true }),
      db.from("messages").select("user_id, created_at").gte("created_at", dayAgo),
      db.from("error_logs").select("id", { count: "exact", head: true }).gte("created_at", dayAgo),
      db
        .from("error_logs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", monthStart),
    ]);

  const planCounts: Record<PlanId, number> = { free: 0, pro: 0, max: 0 };
  for (const p of profiles ?? []) {
    const eff = resolvePlan((p.plan as PlanId) ?? "free", (p as { plan_expires_at?: string }).plan_expires_at ?? null);
    planCounts[eff] += 1;
  }

  const signupsByDay: { day: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now - i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    signupsByDay.push({
      day: key,
      count: users.filter((u) => (u.created_at ?? "").slice(0, 10) === key).length,
    });
  }

  const mrr = planCounts.pro * PLAN_PRICE.pro + planCounts.max * PLAN_PRICE.max;

  return {
    totalUsers: users.length,
    activeToday: new Set((recentMsgs ?? []).map((m) => m.user_id as string)).size,
    activeWeek: users.filter((u) => (u.last_sign_in_at ?? "") >= weekAgo).length,
    newThisMonth: users.filter((u) => (u.created_at ?? "") >= monthStart).length,
    messagesToday: (recentMsgs ?? []).length,
    messagesTotal: messagesTotal ?? 0,
    threadsTotal: threadsTotal ?? 0,
    errorsToday: errorsToday ?? 0,
    errorsMonth: errorsMonth ?? 0,
    mrr,
    monthEarnings: 0,
    paymentsLive: false,
    planCounts,
    signupsByDay,
  };
}

export type AdminError = {
  id: string;
  message: string;
  detail: string | null;
  source: string;
  model: string | null;
  userId: string | null;
  createdAt: string;
};

export async function listErrors(limit: number): Promise<AdminError[]> {
  const db = await admin();
  const { data, error } = await db
    .from("error_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((e) => ({
    id: e.id as string,
    message: e.message as string,
    detail: (e.detail as string) ?? null,
    source: e.source as string,
    model: (e.model as string) ?? null,
    userId: (e.user_id as string) ?? null,
    createdAt: e.created_at as string,
  }));
}

export async function updateUser(input: {
  userId: string;
  plan?: PlanId;
  planExpiresAt?: string | null;
  limitOverride?: number | null;
  adminNote?: string | null;
  resetUsage?: boolean;
  makeAdmin?: boolean;
}): Promise<void> {
  const db = await admin();
  const patch: Record<string, unknown> = { id: input.userId };
  if (input.plan !== undefined) patch['plan'] = input.plan;
  if (input.planExpiresAt !== undefined) patch['plan_expires_at'] = input.planExpiresAt;
  if (input.limitOverride !== undefined) patch['message_limit_override'] = input.limitOverride;
  if (input.adminNote !== undefined) patch['admin_note'] = input.adminNote;

  if (Object.keys(patch).length > 1) {
    const { error } = await db.from("profiles").upsert(patch as never);
    if (error) throw new Error(error.message);
  }

  if (input.resetUsage) {
    await db
      .from("usage_daily")
      .update({ message_count: 0, reset_at: new Date(Date.now() + 12 * 3600_000).toISOString() } as never)
      .eq("user_id", input.userId);
  }

  if (input.makeAdmin !== undefined) {
    if (input.makeAdmin) {
      await db.from("user_roles").upsert(
        { user_id: input.userId, role: "admin" } as never,
        { onConflict: "user_id,role" },
      );
    } else {
      await db.from("user_roles").delete().eq("user_id", input.userId).eq("role", "admin");
    }
  }
}

export async function deleteUserAccount(userId: string): Promise<void> {
  const db = await admin();
  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
}

/** Best-effort error capture so admins can review failures in one place. */
export async function logError(input: {
  message: string;
  detail?: string;
  source?: string;
  model?: string;
  userId?: string;
}): Promise<void> {
  try {
    const db = await admin();
    await db.from("error_logs").insert({
      message: input.message.slice(0, 500),
      detail: input.detail?.slice(0, 8000) ?? null,
      source: input.source ?? "server",
      model: input.model ?? null,
      user_id: input.userId ?? null,
    } as never);
  } catch {
    /* never let logging break a request */
  }
}
