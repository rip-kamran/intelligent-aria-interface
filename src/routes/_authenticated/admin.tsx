import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Crown,
  Gift,
  Loader2,
  MessageSquare,
  PoundSterling,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  Users,
} from "lucide-react";
import {
  adminDeleteUser,
  adminListErrors,
  adminListUsers,
  adminOverview,
  adminUpdateUser,
  amIAdmin,
} from "@/lib/admin.functions";
import type { AdminError, AdminStats, AdminUser } from "@/lib/admin.server";
import { PLANS, type PlanId } from "@/lib/aria-prompts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin Console · Aria" },
      {
        name: "description",
        content:
          "Aria admin console — manage users, plans, message allowances, activity and error logs.",
      },
      { property: "og:title", content: "Admin Console · Aria" },
      {
        property: "og:description",
        content: "Manage Aria users, plans, allowances, activity and errors.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Tab = "overview" | "users" | "errors";

function AdminPage() {
  const navigate = useNavigate();
  const checkAdmin = useServerFn(amIAdmin);
  const loadStats = useServerFn(adminOverview);
  const loadUsers = useServerFn(adminListUsers);
  const loadErrors = useServerFn(adminListErrors);

  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [errors, setErrors] = useState<AdminError[] | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const [s, u, e] = await Promise.all([
        loadStats(),
        loadUsers({ data: { search, limit: 200 } }),
        loadErrors({ data: { limit: 60 } }),
      ]);
      setStats(s as AdminStats);
      setUsers(u as AdminUser[]);
      setErrors(e as AdminError[]);
    } catch {
      /* handled by the guard */
    } finally {
      setBusy(false);
    }
  }, [loadStats, loadUsers, loadErrors, search]);

  useEffect(() => {
    checkAdmin()
      .then((r) => {
        setAllowed(r.isAdmin);
        if (r.isAdmin) void refresh();
      })
      .catch(() => setAllowed(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (allowed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <Shield className="h-8 w-8 text-muted-foreground" />
        <h1 className="text-xl font-medium">Admins only</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          This console is restricted. If you should have access, ask Kamran to grant your account
          the admin role.
        </p>
        <button
          onClick={() => navigate({ to: "/chat" })}
          className="rounded-lg border border-border/60 px-4 py-2 text-sm hover:bg-muted/40"
        >
          Back to Aria
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            to="/chat"
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Aria
          </Link>
          <h1 className="flex items-center gap-2 text-sm font-medium">
            <Shield className="h-4 w-4 text-primary" /> Admin console
          </h1>
          <button
            onClick={() => void refresh()}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} /> Refresh
          </button>
        </div>
        <div className="mx-auto flex max-w-6xl gap-1 px-4 sm:px-6">
          {(["overview", "users", "errors"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm capitalize transition-colors",
                tab === t
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        {tab === "overview" && <Overview stats={stats} />}
        {tab === "users" && (
          <UsersTab
            users={users}
            search={search}
            setSearch={setSearch}
            onSearch={() => void refresh()}
            onChanged={() => void refresh()}
          />
        )}
        {tab === "errors" && <ErrorsTab errors={errors} />}
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-4 backdrop-blur">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" />
        {label}
      </div>
      <div className="mt-2 text-2xl font-medium tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Overview({ stats }: { stats: AdminStats | null }) {
  if (!stats) return <SkeletonGrid />;
  const peak = Math.max(1, ...stats.signupsByDay.map((d) => d.count));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total users" value={stats.totalUsers.toLocaleString()} icon={Users} hint={`${stats.newThisMonth} new this month`} />
        <Stat label="Active (24h)" value={stats.activeToday.toLocaleString()} icon={Activity} hint={`${stats.activeWeek} signed in this week`} />
        <Stat label="Messages" value={stats.messagesTotal.toLocaleString()} icon={MessageSquare} hint={`${stats.messagesToday} in the last 24h`} />
        <Stat label="Errors" value={stats.errorsMonth.toLocaleString()} icon={AlertTriangle} hint={`${stats.errorsToday} in the last 24h`} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-card/50 p-4 lg:col-span-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Sign-ups · last 14 days</span>
            <span>{stats.threadsTotal.toLocaleString()} threads total</span>
          </div>
          <div className="mt-4 flex h-28 items-end gap-1.5">
            {stats.signupsByDay.map((d) => (
              <div key={d.day} className="group flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-primary/70 transition-all group-hover:bg-primary"
                  style={{ height: `${(d.count / peak) * 100}%`, minHeight: d.count ? 4 : 2 }}
                  title={`${d.day}: ${d.count}`}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card/50 p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <PoundSterling className="h-3.5 w-3.5 text-primary" /> Earnings this month
          </div>
          <div className="mt-2 text-2xl font-medium tabular-nums">£{stats.monthEarnings.toFixed(2)}</div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Payments aren't live yet — every paid plan is currently an admin gift.
          </p>
          <div className="mt-3 rounded-lg border border-border/50 bg-background/40 p-3 text-xs">
            <div className="text-muted-foreground">Projected MRR if billed today</div>
            <div className="mt-1 text-lg font-medium tabular-nums">£{stats.mrr.toLocaleString()}</div>
          </div>
          <div className="mt-3 space-y-1.5 text-xs">
            {(Object.keys(stats.planCounts) as PlanId[]).map((p) => (
              <div key={p} className="flex items-center justify-between">
                <span className="text-muted-foreground">{PLANS[p].name}</span>
                <span className="tabular-nums">{stats.planCounts[p]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-xl bg-muted/40" />
      ))}
    </div>
  );
}

function UsersTab({
  users,
  search,
  setSearch,
  onSearch,
  onChanged,
}: {
  users: AdminUser[] | null;
  search: string;
  setSearch: (v: string) => void;
  onSearch: () => void;
  onChanged: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const list = users ?? [];
  const open = useMemo(() => list.find((u) => u.id === openId) ?? null, [list, openId]);

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSearch();
        }}
        className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/50 px-3 py-2"
      >
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email, name or user ID"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <button className="rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground">
          Search
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-border/60">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">User</th>
              <th className="px-3 py-2 font-medium">Plan</th>
              <th className="px-3 py-2 font-medium">Usage</th>
              <th className="hidden px-3 py-2 font-medium sm:table-cell">Chats</th>
              <th className="hidden px-3 py-2 font-medium md:table-cell">Last seen</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id} className="border-t border-border/50">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="truncate">{u.email ?? u.id.slice(0, 8)}</span>
                    {u.isAdmin && <Shield className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  </div>
                  {u.displayName && (
                    <div className="text-[11px] text-muted-foreground">{u.displayName}</div>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[11px]",
                      u.effectivePlan === "free"
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary/15 text-primary",
                    )}
                  >
                    {PLANS[u.effectivePlan].name}
                  </span>
                </td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">
                  {u.used}/{u.limit}
                </td>
                <td className="hidden px-3 py-2 tabular-nums text-muted-foreground sm:table-cell">
                  {u.threads}
                </td>
                <td className="hidden px-3 py-2 text-xs text-muted-foreground md:table-cell">
                  {u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleDateString() : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => setOpenId(u.id)}
                    className="rounded-lg border border-border/60 px-2.5 py-1 text-xs hover:bg-muted/40"
                  >
                    Manage
                  </button>
                </td>
              </tr>
            ))}
            {!list.length && (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-sm text-muted-foreground">
                  {users ? "No users match that search." : "Loading users…"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <UserDrawer
          user={open}
          onClose={() => setOpenId(null)}
          onChanged={() => {
            setOpenId(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function UserDrawer({
  user,
  onClose,
  onChanged,
}: {
  user: AdminUser;
  onClose: () => void;
  onChanged: () => void;
}) {
  const update = useServerFn(adminUpdateUser);
  const remove = useServerFn(adminDeleteUser);
  const [plan, setPlan] = useState<PlanId>(user.plan);
  const [limit, setLimit] = useState(user.limitOverride?.toString() ?? "");
  const [expires, setExpires] = useState(user.planExpiresAt?.slice(0, 10) ?? "");
  const [note, setNote] = useState(user.adminNote ?? "");
  const [creditsDelta, setCreditsDelta] = useState("");
  const [creditsReason, setCreditsReason] = useState("");
  const [resetUsage, setResetUsage] = useState(false);
  const [makeAdmin, setMakeAdmin] = useState(user.isAdmin);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await update({
        data: {
          userId: user.id,
          plan,
          planExpiresAt: expires ? new Date(`${expires}T23:59:59Z`).toISOString() : null,
          limitOverride: limit.trim() === "" ? null : Number(limit),
          adminNote: note.trim() === "" ? null : note,
          resetUsage,
          makeAdmin,
          ...(creditsDelta.trim() === "" || Number(creditsDelta) === 0
            ? {}
            : { creditsDelta: Number(creditsDelta), creditsReason: creditsReason.trim() || undefined }),
        },
      });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 p-0 backdrop-blur sm:items-center sm:p-6">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border/60 bg-card p-5 sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-medium">{user.email ?? user.id}</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Joined {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"} ·{" "}
              {user.messages} messages
            </p>
          </div>
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">
            Close
          </button>
        </div>

        <div className="mt-4 space-y-4 text-sm">
          <div>
            <label className="text-xs text-muted-foreground">Plan (gift instantly)</label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {(["free", "pro", "max"] as PlanId[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPlan(p)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs",
                    plan === p
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/60 text-muted-foreground hover:bg-muted/40",
                  )}
                >
                  {p === "max" ? <Crown className="h-3.5 w-3.5" /> : p === "pro" ? <Gift className="h-3.5 w-3.5" /> : null}
                  {PLANS[p].name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted-foreground">Message limit override</label>
              <input
                value={limit}
                onChange={(e) => setLimit(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder={`Default (${PLANS[plan].dailyMessages})`}
                className="mt-1.5 w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Plan expires</label>
              <input
                type="date"
                value={expires}
                onChange={(e) => setExpires(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="rounded-lg border border-border/60 bg-background/40 p-3">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground">Credits</label>
              <span className="text-xs text-foreground">Balance: {user.credits}</span>
            </div>
            <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
              <input
                value={creditsDelta}
                onChange={(e) => setCreditsDelta(e.target.value.replace(/[^0-9-]/g, ""))}
                placeholder="Add / remove (e.g. 250 or -50)"
                className="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <input
                value={creditsReason}
                onChange={(e) => setCreditsReason(e.target.value)}
                placeholder="Reason (optional)"
                className="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Admin note</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="mt-1.5 w-full resize-none rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={resetUsage} onChange={(e) => setResetUsage(e.target.checked)} />
            Reset this user's usage counter now
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={makeAdmin} onChange={(e) => setMakeAdmin(e.target.checked)} />
            Admin access to this console
          </label>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => void save()}
              disabled={saving}
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              onClick={async () => {
                if (!confirm("Permanently delete this account and all their data?")) return;
                setSaving(true);
                try {
                  await remove({ data: { userId: user.id } });
                  onChanged();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Could not delete user.");
                  setSaving(false);
                }
              }}
              className="rounded-lg border border-destructive/40 p-2 text-destructive hover:bg-destructive/10"
              aria-label="Delete user"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorsTab({ errors }: { errors: AdminError[] | null }) {
  if (!errors) return <SkeletonGrid />;
  if (!errors.length)
    return (
      <div className="rounded-xl border border-border/60 bg-card/50 p-10 text-center text-sm text-muted-foreground">
        No errors logged. Nice.
      </div>
    );
  return (
    <div className="space-y-2">
      {errors.map((e) => (
        <details key={e.id} className="rounded-xl border border-border/60 bg-card/50 p-3">
          <summary className="flex cursor-pointer items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            <span className="min-w-0 flex-1 truncate">{e.message}</span>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {new Date(e.createdAt).toLocaleString()}
            </span>
          </summary>
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            <div>
              Source: {e.source}
              {e.model ? ` · Model: ${e.model}` : ""}
              {e.userId ? ` · User: ${e.userId.slice(0, 8)}…` : ""}
            </div>
            {e.detail && (
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-background/60 p-2 text-[11px]">
                {e.detail}
              </pre>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}
