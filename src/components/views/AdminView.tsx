"use client";

import { useCallback, useEffect, useState } from "react";
import { ADMIN_TABLES, type AdminTable } from "@/lib/adminTables";
import { Card, SectionTitle, Button, Segmented, Spinner, EmptyState } from "@/components/ui";
import { useConfirm } from "@/components/ui";

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

type Tab = "stats" | "tables" | "users";

export default function AdminView() {
  const [tab, setTab] = useState<Tab>("stats");

  return (
    <div className="px-4 pb-28 pt-2">
      <SectionTitle
        action={
          <a href="/api/admin/export" className="ios-btn-ghost text-[14px]">
            خروجی بک‌آپ
          </a>
        }
      >
        پنل مدیریت
      </SectionTitle>

      <div className="mb-4">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: "stats", label: "آمار" },
            { value: "tables", label: "جدول‌ها" },
            { value: "users", label: "کاربران" },
          ]}
        />
      </div>

      {tab === "stats" && <StatsTab />}
      {tab === "tables" && <TablesTab />}
      {tab === "users" && <UsersTab />}
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

function TablesTab() {
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
                  {row.id != null && (
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
  created_at: string;
  passkeys: number;
};

function UsersTab() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
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
      {users.length === 0 && <EmptyState icon="inbox" title="کاربری نیست" />}
      {users.map((u) => (
        <Card key={u.id} className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-semibold">{u.display_name || u.username}</div>
            <div className="secondary text-[13px]">
              @{u.username} · {u.passkeys} پسکی
            </div>
          </div>
          <button
            onClick={() => del(u)}
            className="shrink-0 text-[13px] font-semibold text-[var(--danger,#ff453a)]"
          >
            حذف
          </button>
        </Card>
      ))}
    </div>
  );
}
