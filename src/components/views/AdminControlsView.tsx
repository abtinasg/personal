"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, Spinner, EmptyState } from "@/components/ui";
import { fa, money } from "@/lib/format";

/* ───────────────────────── انواع ───────────────────────── */

type Flag = {
  key: string;
  enabled: boolean;
  value: { toman?: number } | null;
  description: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
};

type AuditRow = {
  id: string;
  actor: string;
  action: string;
  target_table: string | null;
  target_id: string | null;
  meta: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
};

/* برچسب‌های فارسی */
const FLAG_FA: Record<string, { title: string; on: string; off: string; dangerWhenOn?: boolean }> = {
  ai_enabled: { title: "هوش مصنوعیِ جوانه", on: "فعال", off: "قطع" },
  signups_enabled: { title: "ثبت‌نام و ورودِ مهمان", on: "باز", off: "بسته" },
  payments_enabled: { title: "درگاهِ پرداخت", on: "باز", off: "بسته" },
  maintenance_mode: { title: "حالتِ تعمیر (قطعِ همه‌چیز)", on: "روشن", off: "خاموش", dangerWhenOn: true },
};
const ACTION_FA: Record<string, string> = {
  set_flag: "تغییرِ فلگ",
  delete_row: "حذفِ رکورد",
  update_row: "ویرایشِ رکورد",
  delete_user: "حذفِ کاربر",
  export: "خروجیِ بک‌آپ",
  ai_auto_kill: "قطعِ خودکارِ هوش مصنوعی (بودجه)",
};

function timeFa(iso: string): string {
  const d = new Date(iso);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "همین حالا";
  if (mins < 60) return `${fa(mins)} دقیقه پیش`;
  if (mins < 1440) return `${fa(Math.floor(mins / 60))} ساعت پیش`;
  return d.toLocaleDateString("fa-IR");
}

/* ───────────────────────── سوییچ ───────────────────────── */

function Toggle({ on, danger, onClick, busy }: { on: boolean; danger?: boolean; onClick: () => void; busy?: boolean }) {
  const activeColor = danger ? "#ff453a" : "#34c759";
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="relative h-[31px] w-[51px] shrink-0 rounded-full transition disabled:opacity-50"
      style={{ background: on ? activeColor : "var(--t-grey,#e5e5ea)" }}
      aria-pressed={on}
    >
      <span
        className="absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-soft transition-all"
        style={{ insetInlineStart: on ? 22 : 2 }}
      />
    </button>
  );
}

/* ───────────────────────── کامپوننتِ اصلی ───────────────────────── */

export default function AdminControlsView() {
  const [flags, setFlags] = useState<Flag[] | null>(null);
  const [audit, setAudit] = useState<AuditRow[] | null>(null);
  const [spendToman, setSpendToman] = useState<number | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const loadFlags = useCallback(() => {
    fetch("/api/admin/flags").then((r) => r.json()).then((d) => setFlags(d.flags ?? [])).catch(() => setFlags([]));
  }, []);
  const loadAudit = useCallback(() => {
    fetch("/api/admin/audit?limit=60").then((r) => r.json()).then((d) => setAudit(d.entries ?? [])).catch(() => setAudit([]));
  }, []);

  useEffect(() => {
    loadFlags();
    loadAudit();
    fetch("/api/admin/metrics").then((r) => r.json()).then((d) => setSpendToman(d?.ai?.estCostTomanToday ?? 0)).catch(() => setSpendToman(0));
  }, [loadFlags, loadAudit]);

  const setFlag = useCallback(
    async (key: string, patch: { enabled?: boolean; value?: Record<string, unknown> }) => {
      setBusyKey(key);
      try {
        const r = await fetch("/api/admin/flags", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ key, ...patch }),
        });
        const d = await r.json();
        if (d.flags) setFlags(d.flags);
        loadAudit(); // هر تغییر در ممیزی می‌افتد
      } finally {
        setBusyKey(null);
      }
    },
    [loadAudit]
  );

  if (!flags) return <Spinner className="mt-10 block mx-auto" />;

  const killSwitches = flags.filter((f) => FLAG_FA[f.key]);
  const budget = flags.find((f) => f.key === "ai_daily_budget");

  return (
    <div>
      {/* ───── کلیدهای قطع ───── */}
      <h3 className="mb-2 mt-2 px-1 text-[15px] font-bold" style={{ color: "var(--ink)" }}>کلیدهای قطع</h3>
      <div className="space-y-2">
        {killSwitches.map((f) => {
          const meta = FLAG_FA[f.key];
          const danger = !!meta.dangerWhenOn;
          // برای maintenance، «روشن» یعنی قطعِ همه‌چیز → خطرناک وقتی on.
          const shownDanger = danger ? f.enabled : !f.enabled;
          return (
            <Card key={f.key} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold" style={{ color: "var(--ink)" }}>{meta.title}</div>
                <div className="secondary text-[12px]">
                  وضعیت: <span style={{ color: shownDanger ? "#ff453a" : "#34c759", fontWeight: 700 }}>
                    {f.enabled ? meta.on : meta.off}
                  </span>
                  {f.updatedBy && <> · آخرین تغییر: {f.updatedBy}{f.updatedAt ? ` (${timeFa(f.updatedAt)})` : ""}</>}
                </div>
              </div>
              <Toggle
                on={f.enabled}
                danger={danger}
                busy={busyKey === f.key}
                onClick={() => setFlag(f.key, { enabled: !f.enabled })}
              />
            </Card>
          );
        })}
      </div>

      {/* ───── پایشِ هزینه ───── */}
      <h3 className="mb-2 mt-6 px-1 text-[15px] font-bold" style={{ color: "var(--ink)" }}>پایشِ هزینه‌ی هوش مصنوعی</h3>
      <CostBudget
        budget={budget}
        spendToman={spendToman}
        busy={busyKey === "ai_daily_budget"}
        onSave={(enabled, toman) => setFlag("ai_daily_budget", { enabled, value: { toman } })}
      />

      {/* ───── گزارشِ ممیزی ───── */}
      <h3 className="mb-2 mt-6 px-1 text-[15px] font-bold" style={{ color: "var(--ink)" }}>گزارشِ ممیزی</h3>
      {!audit ? (
        <Spinner className="mt-6 block mx-auto" />
      ) : audit.length === 0 ? (
        <EmptyState icon="inbox" title="هنوز کنشی ثبت نشده" />
      ) : (
        <div className="space-y-2">
          {audit.map((e) => (
            <Card key={e.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold" style={{ color: e.actor === "system" ? "#ff9f0a" : "var(--ink)" }}>
                  {ACTION_FA[e.action] ?? e.action}
                </div>
                <div className="secondary text-[12px]">
                  {e.actor}
                  {e.target_table && <> · {e.target_table}{e.target_id ? `/${e.target_id.slice(0, 8)}` : ""}</>}
                  {e.ip && e.ip !== "unknown" && <> · {e.ip}</>}
                </div>
              </div>
              <span className="secondary shrink-0 text-[11px]">{timeFa(e.created_at)}</span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── بودجه ───────────────────────── */

function CostBudget({
  budget, spendToman, busy, onSave,
}: {
  budget: Flag | undefined;
  spendToman: number | null;
  busy: boolean;
  onSave: (enabled: boolean, toman: number) => void;
}) {
  const [toman, setToman] = useState<string>(String(budget?.value?.toman ?? 0));
  useEffect(() => { setToman(String(budget?.value?.toman ?? 0)); }, [budget]);

  const limit = Number(budget?.value?.toman ?? 0) || 0;
  const spend = spendToman ?? 0;
  const pct = limit > 0 ? Math.min(100, Math.round((spend / limit) * 100)) : 0;
  const over = limit > 0 && spend >= limit;
  const enabled = !!budget?.enabled;

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <div className="font-semibold" style={{ color: "var(--ink)" }}>قطعِ خودکار با عبور از بودجه</div>
        <Toggle on={enabled} busy={busy} onClick={() => onSave(!enabled, limit)} />
      </div>
      <div className="secondary mb-3 text-[12px]">
        اگر روشن باشد و خرجِ تخمینیِ امروز از سقف بگذرد، کرانِ هر ۱۰ دقیقه هوش مصنوعی را خودکار قطع می‌کند.
      </div>

      <div className="mb-1 flex items-center justify-between text-[13px]">
        <span className="secondary">خرجِ امروز (تخمینی)</span>
        <span className="tabular-nums" style={{ color: over ? "#ff453a" : "var(--ink)", fontWeight: 700 }}>
          {money(spend)}{limit > 0 ? ` / ${money(limit)}` : ""}
        </span>
      </div>
      <div className="mb-3 h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--t-grey,#eee)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: over ? "#ff453a" : pct >= 70 ? "#ff9f0a" : "#34c759" }} />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          value={toman}
          onChange={(e) => setToman(e.target.value)}
          className="ios-input flex-1"
          placeholder="سقفِ روزانه به تومان"
          dir="ltr"
        />
        <button
          onClick={() => onSave(enabled, Math.max(0, Number(toman) || 0))}
          disabled={busy}
          className="ios-btn-ghost shrink-0 text-[14px] font-semibold disabled:opacity-50"
        >
          ذخیره
        </button>
      </div>
    </Card>
  );
}
