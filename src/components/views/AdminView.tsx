"use client";

import { useCallback, useEffect, useState } from "react";
import { ADMIN_TABLES, type AdminTable } from "@/lib/adminTables";
import { Card, SectionTitle, Segmented, Spinner, EmptyState } from "@/components/ui";
import { useConfirm } from "@/components/ui";
import { ROLE_FA, ASSIGNABLE_ROLES, type Capability, type Role } from "@/lib/roles";
import AdminDashboardView from "@/components/views/AdminDashboardView";
import AdminControlsView from "@/components/views/AdminControlsView";
import AdminTicketsView from "@/components/views/AdminTicketsView";

const TABLE_LABELS: Record<string, string> = {
  users: "کاربران",
  credentials: "پسکی‌ها",
  profiles: "پروفایل‌ها",
  meals: "وعده‌های غذایی",
  transactions: "تراکنش‌ها",
  health_metrics: "سنجه‌های سلامت",
  habits: "عادت‌ها",
  habit_logs: "ثبت عادت‌ها",
  moods: "حال و حوصله",
  identities: "هویت‌ها",
  missions: "مأموریت‌ها",
  mission_milestones: "نقاط عطف",
  mission_habits: "عادتِ مأموریت",
  rewards: "جوایز",
  reward_claims: "دریافتِ جوایز",
  workout_plans: "برنامه‌های ورزشی",
  purchase_goals: "اهداف خرید",
};

type Tab = "dashboard" | "tickets" | "controls" | "stats" | "tables" | "users";

/** هر تب چه مجوزی لازم دارد (کمترین‌دسترسی). */
const TAB_CAP: Record<Tab, Capability> = {
  dashboard: "view_admin",
  tickets: "handle_tickets",
  controls: "manage_flags",
  stats: "view_admin",
  tables: "view_admin",
  users: "view_admin",
};

const TAB_LABEL: Record<Tab, string> = {
  dashboard: "داشبورد",
  tickets: "تیکت‌ها",
  controls: "کنترل",
  stats: "آمار",
  tables: "جدول‌ها",
  users: "کاربران",
};

type Me = { role: Role; roleLabel: string; capabilities: Capability[] };

export default function AdminView() {
  const [me, setMe] = useState<Me | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");

  useEffect(() => {
    fetch("/api/admin/me")
      .then((r) => r.json())
      .then((d) => setMe(d?.capabilities ? d : { role: "support", roleLabel: "پشتیبان", capabilities: ["view_admin"] }))
      .catch(() => setMe({ role: "support", roleLabel: "پشتیبان", capabilities: ["view_admin"] }));
  }, []);

  if (!me) return <Spinner className="mt-10 block mx-auto" />;

  const caps = new Set(me.capabilities);
  const tabs = (Object.keys(TAB_CAP) as Tab[]).filter((t) => caps.has(TAB_CAP[t]));
  // اگر تبِ فعلی برای این نقش مجاز نیست، به اولین تبِ مجاز برگرد.
  const activeTab = tabs.includes(tab) ? tab : tabs[0];

  return (
    <div className="px-4 pb-28 pt-2">
      <SectionTitle
        action={
          caps.has("export_data") ? (
            <a href="/api/admin/export" className="ios-btn-ghost text-[14px]">
              خروجی بک‌آپ
            </a>
          ) : (
            <span className="secondary text-[13px]">{me.roleLabel}</span>
          )
        }
      >
        پنل مدیریت
      </SectionTitle>

      <div className="mb-4">
        <Segmented<Tab>
          value={activeTab}
          onChange={setTab}
          options={tabs.map((t) => ({ value: t, label: TAB_LABEL[t] }))}
        />
      </div>

      {activeTab === "dashboard" && <AdminDashboardView />}
      {activeTab === "tickets" && <AdminTicketsView />}
      {activeTab === "controls" && <AdminControlsView />}
      {activeTab === "stats" && <StatsTab />}
      {activeTab === "tables" && <TablesTab canDelete={caps.has("manage_data")} />}
      {activeTab === "users" && (
        <UsersTab canDelete={caps.has("manage_users")} canManageRoles={caps.has("manage_roles")} />
      )}
    </div>
  );
}

/* ---------------- آمار ---------------- */

function StatsTab() {
  const [rows, setRows] = useState<{ name: string; count: number | null }[] | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((d) => setRows(d.tables ?? []))
      .catch(() => setRows([]));
  }, []);

  if (!rows) return <Spinner className="mt-10 block mx-auto" />;

  return (
    <div className="grid grid-cols-2 gap-3">
      {rows.map((r) => (
        <Card key={r.name} className="text-center">
          <div className="text-[28px] font-bold tabular-nums">{r.count ?? "—"}</div>
          <div className="secondary mt-1 text-[13px]">{TABLE_LABELS[r.name] ?? r.name}</div>
        </Card>
      ))}
    </div>
  );
}

/* ---------------- جدول‌ها ---------------- */

function TablesTab({ canDelete }: { canDelete: boolean }) {
  const [table, setTable] = useState<AdminTable>("transactions");
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [total, setTotal] = useState(0);
  const { confirm, dialog } = useConfirm();

  const load = useCallback(() => {
    setRows(null);
    fetch(`/api/admin/table?name=${table}&limit=50`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d.rows ?? []);
        setTotal(d.total ?? 0);
      })
      .catch(() => setRows([]));
  }, [table]);

  useEffect(() => {
    load();
  }, [load]);

  const del = async (id: string) => {
    const okToDel = await confirm({
      title: "حذف رکورد؟",
      message: "این رکورد برای همیشه حذف می‌شود.",
      confirmLabel: "حذف",
      danger: true,
    });
    if (!okToDel) return;
    await fetch(`/api/admin/table?name=${table}&id=${encodeURIComponent(id)}`, { method: "DELETE" });
    load();
  };

  return (
    <div>
      {dialog}
      <select
        value={table}
        onChange={(e) => setTable(e.target.value as AdminTable)}
        className="ios-input mb-4 w-full"
      >
        {ADMIN_TABLES.map((t) => (
          <option key={t} value={t}>
            {TABLE_LABELS[t] ?? t}
          </option>
        ))}
      </select>

      {!rows ? (
        <Spinner className="mt-10 block mx-auto" />
      ) : rows.length === 0 ? (
        <EmptyState icon="inbox" title="رکوردی نیست" />
      ) : (
        <>
          <div className="secondary mb-2 px-1 text-[13px]">{total} رکورد</div>
          <div className="space-y-2">
            {rows.map((row, i) => (
              <Card key={(row.id as string) ?? i} className="overflow-hidden">
                <div className="flex items-start justify-between gap-3">
                  <pre className="min-w-0 flex-1 overflow-x-auto text-left text-[11px] leading-5 secondary" dir="ltr">
                    {JSON.stringify(row, null, 2)}
                  </pre>
                  {canDelete && row.id != null && (
                    <button
                      onClick={() => del(String(row.id))}
                      className="shrink-0 text-[13px] font-semibold text-[var(--danger,#ff453a)]"
                    >
                      حذف
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------- کاربران ---------------- */

type AdminUser = {
  id: string;
  username: string;
  display_name: string | null;
  role: Role;
  created_at: string;
  passkeys: number;
};

function UsersTab({ canDelete, canManageRoles }: { canDelete: boolean; canManageRoles: boolean }) {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  const load = useCallback(() => {
    setUsers(null);
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((d) => setUsers(d.users ?? []))
      .catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setRole = async (u: AdminUser, role: Role) => {
    if (role === u.role) return;
    setSavingId(u.id);
    try {
      const r = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: u.id, role }),
      });
      const d = await r.json().catch(() => ({}));
      if (d?.error) alert(d.error);
      load();
    } finally {
      setSavingId(null);
    }
  };

  const del = async (u: AdminUser) => {
    const okToDel = await confirm({
      title: `حذف ${u.display_name || u.username}؟`,
      message: "همه‌ی دیتا و پسکی‌های این کاربر هم پاک می‌شود.",
      confirmLabel: "حذف",
      danger: true,
    });
    if (!okToDel) return;
    await fetch(`/api/admin/users?id=${u.id}`, { method: "DELETE" });
    load();
  };

  if (!users) return <Spinner className="mt-10 block mx-auto" />;

  return (
    <div className="space-y-2">
      {dialog}
      {canManageRoles && (
        <div className="secondary mb-1 px-1 text-[12px]">
          نقشِ هر عضو را عوض کن. مالک = همه‌چیز · مدیر = داده و کلیدها · پشتیبان = فقط خواندن و تیکت.
        </div>
      )}
      {users.length === 0 && <EmptyState icon="inbox" title="کاربری نیست" />}
      {users.map((u) => (
        <Card key={u.id} className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-semibold">
              {u.display_name || u.username}
              {u.role !== "user" && (
                <span
                  className="ms-2 rounded-full px-2 py-0.5 text-[11px] font-bold"
                  style={{ background: "var(--blue,#0a84ff)", color: "#fff" }}
                >
                  {ROLE_FA[u.role]}
                </span>
              )}
            </div>
            <div className="secondary text-[13px]">
              @{u.username} · {u.passkeys} پسکی
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canManageRoles && (
              <select
                value={u.role}
                disabled={savingId === u.id}
                onChange={(e) => setRole(u, e.target.value as Role)}
                className="ios-input !py-1 text-[13px]"
              >
                {ASSIGNABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_FA[r]}
                  </option>
                ))}
              </select>
            )}
            {canDelete && (
              <button
                onClick={() => del(u)}
                className="text-[13px] font-semibold text-[var(--danger,#ff453a)]"
              >
                حذف
              </button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
