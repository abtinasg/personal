"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, Segmented, Spinner, EmptyState } from "@/components/ui";
import { fa, faShort, money, tomanWords } from "@/lib/format";

/* ───────────────────────── انواع پاسخِ /api/admin/metrics ───────────────────────── */

type Metrics = {
  generatedAt: string;
  queryMs: number;
  overview: {
    live: number; signupsToday: number; paidToday: number; revToday: number;
    aiCallsToday: number; aiCostTomanToday: number; aiCapPct: number;
    errorsToday: number; stuckPayments: number; activeSubs: number; dbLatencyMs: number;
  };
  founder: {
    dau: number; wau: number; mau: number; signupsToday: number; signups7d: number;
    totalUsers: number; totalGuests: number; activationPct: number; d1Pct: number; d7Pct: number;
    payingUsers: number; mrr: number; revToday: number; aiCostTomanToday: number; profitToday: number;
  };
  revenue: {
    revToday: number; rev7d: number; paidToday: number;
    byDay: { d: string; total: number; n: number }[];
    status: { status: string; n: number; total: number }[];
    byPlan: { plan: string; n: number; total: number }[];
    stuck: { id: string; amount: number; plan: string | null; cycle: string | null; createdAt: string; user: string }[];
    activationsToday: number; renewalsToday: number;
  };
  ai: {
    callsToday: number; calls7d: number; usersToday: number; cap: number; capPct: number;
    estCostUsdToday: number; estCostTomanToday: number;
    byEndpoint: { endpoint: string; n: number }[];
    topUsers: { n: number; user: string; isGuest: boolean }[];
    errorsToday: number;
  };
  ops: {
    otpToday: number; otpClosedToday: number; guestToday: number;
    guestByIp: { ip: string; n: number }[]; pushSubs: number; stuckPayments: number;
  };
  funnel: { guestStart: number; signup: number; checkoutStart: number; paymentPaid: number };
};

type Sub = "war" | "founder" | "revenue" | "ai" | "ops";

/* ───────────────────────── ابزارکِ‌های کوچک ───────────────────────── */

type Health = "ok" | "warn" | "bad";
const DOT: Record<Health, string> = { ok: "#34c759", warn: "#ff9f0a", bad: "#ff453a" };

/** کارتِ آمار با نقطه‌ی سلامت (سبز/زرد/قرمز). */
function Stat({ label, value, sub, health }: { label: string; value: React.ReactNode; sub?: string; health?: Health }) {
  return (
    <Card className="relative">
      {health && (
        <span className="absolute left-3 top-3 inline-block h-2.5 w-2.5 rounded-full" style={{ background: DOT[health] }} />
      )}
      <div className="text-[26px] font-bold tabular-nums leading-tight" style={{ color: "var(--ink)" }}>{value}</div>
      <div className="secondary mt-1 text-[13px]">{label}</div>
      {sub && <div className="secondary mt-0.5 text-[11px] opacity-70">{sub}</div>}
    </Card>
  );
}

/** میله‌ی افقیِ ساده برای توزیع‌ها. */
function MiniBars({ items, color = "var(--blue,#0a84ff)" }: { items: { label: string; value: number; hint?: string }[]; color?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) return <EmptyState icon="inbox" title="داده‌ای نیست" />;
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i}>
          <div className="mb-1 flex items-center justify-between text-[13px]">
            <span className="truncate" style={{ color: "var(--ink)" }}>{it.label}</span>
            <span className="secondary tabular-nums">{it.hint ?? fa(it.value)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--t-grey,#eee)" }}>
            <div className="h-full rounded-full" style={{ width: `${(it.value / max) * 100}%`, background: color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function SubHead({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 mt-5 px-1 text-[15px] font-bold" style={{ color: "var(--ink)" }}>{children}</h3>;
}

const STATUS_FA: Record<string, string> = {
  paid: "موفق", pending: "در انتظار", failed: "ناموفق", canceled: "لغو", expired: "منقضی",
};
const ENDPOINT_FA: Record<string, string> = {
  coach_chat: "گفتگو با جوانه", coach_briefing: "بریفینگ", coach_invest: "سرمایه‌گذاری",
  coach_parse: "تحلیلِ متن", coach_nutrition: "تغذیه", coach_workout: "تمرین", coach_weekly: "مرورِ هفتگی",
  meal_estimate: "تخمینِ کالری", meal_report: "گزارشِ غذا", mission_generate: "ساختِ ماموریت",
};

function timeAgoFa(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${fa(mins)} دقیقه پیش`;
  return `${fa(Math.floor(mins / 60))} ساعت پیش`;
}

/* ───────────────────────── کامپوننتِ اصلی ───────────────────────── */

export default function AdminDashboardView() {
  const [sub, setSub] = useState<Sub>("war");
  const [m, setM] = useState<Metrics | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/metrics")
      .then((r) => r.json())
      .then((d) => { if (d.error) setErr(d.error); else { setM(d); setErr(null); } })
      .catch(() => setErr("خطا در بارگذاری"))
      .finally(() => setLoading(false));
  }, []);

  // بارگذاریِ اولیه + رفرشِ خودکار هر ۶۰ ثانیه (اتاقِ جنگ).
  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  if (!m && loading) return <Spinner className="mt-10 block mx-auto" />;
  if (err && !m) return <EmptyState icon="alert" title="خطا" sub={err} />;
  if (!m) return null;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="secondary text-[12px]">
          به‌روزرسانی: {new Date(m.generatedAt).toLocaleTimeString("fa-IR")} · {fa(m.queryMs)}ms
        </div>
        <button onClick={load} className="ios-btn-ghost text-[13px]" disabled={loading}>
          {loading ? "…" : "↻ تازه‌سازی"}
        </button>
      </div>

      <div className="mb-4">
        <Segmented<Sub>
          value={sub}
          onChange={setSub}
          options={[
            { value: "war", label: "اتاق جنگ" },
            { value: "founder", label: "بنیان‌گذار" },
            { value: "revenue", label: "درآمد" },
            { value: "ai", label: "هوش مصنوعی" },
            { value: "ops", label: "عملیات" },
          ]}
        />
      </div>

      {sub === "war" && <WarRoom m={m} />}
      {sub === "founder" && <Founder m={m} />}
      {sub === "revenue" && <Revenue m={m} />}
      {sub === "ai" && <Ai m={m} />}
      {sub === "ops" && <Ops m={m} />}
    </div>
  );
}

/* ───────────────────────── اتاقِ جنگ ───────────────────────── */

function WarRoom({ m }: { m: Metrics }) {
  const o = m.overview;
  const aiHealth: Health = o.aiCapPct >= 95 ? "bad" : o.aiCapPct >= 70 ? "warn" : "ok";
  const errHealth: Health = o.errorsToday >= 20 ? "bad" : o.errorsToday >= 5 ? "warn" : "ok";
  const payHealth: Health = o.stuckPayments > 0 ? "warn" : "ok";
  const dbHealth: Health = o.dbLatencyMs > 1500 ? "bad" : o.dbLatencyMs > 600 ? "warn" : "ok";

  return (
    <div className="grid grid-cols-2 gap-3">
      <Stat label="کاربرانِ زنده (۱۵ دقیقه)" value={fa(o.live)} health={o.live > 0 ? "ok" : "warn"} />
      <Stat label="ثبت‌نامِ امروز" value={fa(o.signupsToday)} health="ok" />
      <Stat label="پرداختِ موفقِ امروز" value={fa(o.paidToday)} sub={tomanWords(o.revToday) || undefined} health="ok" />
      <Stat label="اشتراکِ فعال" value={fa(o.activeSubs)} health="ok" />
      <Stat label="فراخوانیِ AI امروز" value={fa(o.aiCallsToday)} sub={`${fa(o.aiCapPct)}٪ سقف`} health={aiHealth} />
      <Stat label="هزینهٔ AI امروز (تخمینی)" value={tomanWords(o.aiCostTomanToday) || "۰"} health={aiHealth} />
      <Stat label="خطاهای امروز" value={fa(o.errorsToday)} health={errHealth} />
      <Stat label="پرداختِ گیرکرده" value={fa(o.stuckPayments)} sub={o.stuckPayments > 0 ? "بررسی کن" : "همه نهایی شده"} health={payHealth} />
      <div className="col-span-2">
        <Stat label="سلامتِ دیتابیس" value={`${fa(o.dbLatencyMs)} ms`} sub="تأخیرِ پاسخِ کوئریِ آمار" health={dbHealth} />
      </div>
    </div>
  );
}

/* ───────────────────────── بنیان‌گذار ───────────────────────── */

function Founder({ m }: { m: Metrics }) {
  const f = m.founder;
  return (
    <div>
      <SubHead>کاربران</SubHead>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="DAU" value={fa(f.dau)} />
        <Stat label="WAU" value={fa(f.wau)} />
        <Stat label="MAU" value={fa(f.mau)} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Stat label="کلِ کاربران" value={fa(f.totalUsers)} sub={`${fa(f.totalGuests)} مهمان`} />
        <Stat label="ثبت‌نامِ ۷ روز" value={fa(f.signups7d)} sub={`امروز ${fa(f.signupsToday)}`} />
        <Stat label="نرخِ فعال‌سازی (۲۴ساعت)" value={`${fa(f.activationPct)}٪`} health={f.activationPct >= 40 ? "ok" : "warn"} />
        <Stat label="ماندگاریِ روزِ ۱" value={`${fa(f.d1Pct)}٪`} health={f.d1Pct >= 30 ? "ok" : "warn"} />
        <Stat label="ماندگاریِ روزِ ۷" value={`${fa(f.d7Pct)}٪`} health={f.d7Pct >= 15 ? "ok" : "warn"} />
        <Stat label="کاربرانِ پولی" value={fa(f.payingUsers)} />
      </div>

      <SubHead>درآمد و سود</SubHead>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="MRR (نرمالایزشده)" value={money(f.mrr)} />
        <Stat label="درآمدِ امروز" value={money(f.revToday)} />
        <Stat label="هزینهٔ AI امروز (تخمینی)" value={money(f.aiCostTomanToday)} />
        <Stat label="سودِ تخمینیِ امروز" value={money(f.profitToday)} health={f.profitToday >= 0 ? "ok" : "warn"} />
      </div>

      <SubHead>قیفِ تبدیل (۷ روز)</SubHead>
      <Card>
        <MiniBars
          items={[
            { label: "ورودِ مهمان", value: m.funnel.guestStart },
            { label: "ثبت‌نام با شماره", value: m.funnel.signup },
            { label: "شروعِ پرداخت", value: m.funnel.checkoutStart },
            { label: "پرداختِ موفق", value: m.funnel.paymentPaid },
          ]}
        />
      </Card>
    </div>
  );
}

/* ───────────────────────── درآمد ───────────────────────── */

function Revenue({ m }: { m: Metrics }) {
  const r = m.revenue;
  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="درآمدِ امروز" value={money(r.revToday)} />
        <Stat label="درآمدِ ۷ روز" value={money(r.rev7d)} />
        <Stat label="پرداختِ موفقِ امروز" value={fa(r.paidToday)} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Stat label="فعال‌سازیِ اشتراکِ امروز" value={fa(r.activationsToday)} />
        <Stat label="تمدیدِ امروز" value={fa(r.renewalsToday)} />
      </div>

      <SubHead>درآمدِ روزانه (۱۴ روز)</SubHead>
      <Card>
        <MiniBars
          color="#34c759"
          items={r.byDay.map((d) => ({ label: d.d, value: d.total, hint: faShort(d.total) }))}
        />
      </Card>

      <SubHead>وضعیتِ پرداخت‌ها (۳۰ روز)</SubHead>
      <Card>
        <MiniBars
          items={r.status.map((s) => ({ label: STATUS_FA[s.status] ?? s.status, value: s.n }))}
        />
      </Card>

      <SubHead>درآمد به تفکیکِ پلن</SubHead>
      <Card>
        <MiniBars
          color="#5e5ce6"
          items={r.byPlan.map((p) => ({ label: p.plan, value: p.total, hint: faShort(p.total) }))}
        />
      </Card>

      <SubHead>پرداختِ گیرکرده (پول کسر شده، اشتراک فعال نشده؟)</SubHead>
      {r.stuck.length === 0 ? (
        <EmptyState icon="check" title="هیچ پرداختِ گیرکرده‌ای نیست" sub="کرانِ تطبیق همه را نهایی کرده" />
      ) : (
        <div className="space-y-2">
          {r.stuck.map((s) => (
            <Card key={s.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-semibold">{s.user}</div>
                <div className="secondary text-[12px]">
                  {money(s.amount)} · {s.plan ?? "اعتبار"} · {timeAgoFa(s.createdAt)}
                </div>
              </div>
              <span className="shrink-0 text-[12px] font-semibold" style={{ color: DOT.warn }}>در انتظار</span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── هوش مصنوعی ───────────────────────── */

function Ai({ m }: { m: Metrics }) {
  const a = m.ai;
  const capHealth: Health = a.capPct >= 95 ? "bad" : a.capPct >= 70 ? "warn" : "ok";
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="فراخوانیِ امروز" value={fa(a.callsToday)} sub={`از سقفِ ${fa(a.cap)}`} health={capHealth} />
        <Stat label="مصرفِ سقف" value={`${fa(a.capPct)}٪`} health={capHealth} />
        <Stat label="کاربرانِ فعالِ AI امروز" value={fa(a.usersToday)} />
        <Stat label="فراخوانیِ ۷ روز" value={fa(a.calls7d)} />
        <Stat label="هزینهٔ امروز (تخمینی)" value={money(a.estCostTomanToday)} sub={`~$${a.estCostUsdToday}`} />
        <Stat label="خطاهای AI امروز" value={fa(a.errorsToday)} health={a.errorsToday >= 10 ? "warn" : "ok"} />
      </div>

      <SubHead>فراخوانی به تفکیکِ سرویس (امروز)</SubHead>
      <Card>
        <MiniBars
          color="#ff9f0a"
          items={a.byEndpoint.map((e) => ({ label: ENDPOINT_FA[e.endpoint] ?? e.endpoint, value: e.n }))}
        />
      </Card>

      <SubHead>پرمصرف‌ترین کاربران (امروز)</SubHead>
      {a.topUsers.length === 0 ? (
        <EmptyState icon="inbox" title="فراخوانی‌ای امروز نبوده" />
      ) : (
        <div className="space-y-2">
          {a.topUsers.map((u, i) => (
            <Card key={i} className="flex items-center justify-between gap-3">
              <div className="truncate font-semibold">
                {u.user}{u.isGuest && <span className="secondary text-[12px]"> (مهمان)</span>}
              </div>
              <span className="tabular-nums secondary">{fa(u.n)} فراخوان</span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── عملیات ───────────────────────── */

function Ops({ m }: { m: Metrics }) {
  const o = m.ops;
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="ارسالِ کدِ امروز" value={fa(o.otpToday)} />
        <Stat
          label="کدِ ردشده (شبانه)"
          value={fa(o.otpClosedToday)}
          sub={o.otpClosedToday > 0 ? "ثبت‌نامِ ازدست‌رفته" : undefined}
          health={o.otpClosedToday >= 5 ? "warn" : "ok"}
        />
        <Stat label="مهمانِ امروز" value={fa(o.guestToday)} />
        <Stat label="مشترکینِ پوش" value={fa(o.pushSubs)} />
        <Stat label="پرداختِ گیرکرده" value={fa(o.stuckPayments)} health={o.stuckPayments > 0 ? "warn" : "ok"} />
      </div>

      <SubHead>پرتکرارترین IPهای ساختِ مهمان (۲۴ ساعت)</SubHead>
      <Card>
        <MiniBars
          color="#ff453a"
          items={o.guestByIp.map((g) => ({ label: g.ip, value: g.n }))}
        />
      </Card>
    </div>
  );
}
