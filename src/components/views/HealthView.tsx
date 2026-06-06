"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiSend } from "@/lib/client";
import { fa, parseNum, todayISO, daysAgoISO, jWeekday, jDateShort } from "@/lib/format";
import type { HealthMetric, Profile } from "@/lib/types";
import { Card, Sheet, Field, Button, Spinner, SectionTitle, StatTile, IconChip, DarkActivityChart, BarChart } from "@/components/ui";
import { AppIcon } from "@/components/AppIcon";

export default function HealthView({ profile }: { profile: Profile | null }) {
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState<null | "weight" | "sleep" | "steps">(null);
  const today = todayISO();

  const load = useCallback(async () => {
    const { metrics } = await apiGet<{ metrics: HealthMetric[] }>(`/api/health?from=${daysAgoISO(30)}`);
    setMetrics(metrics);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const waterGoal = profile?.water_goal_ml || 2000;
  const waterToday = useMemo(
    () => metrics.filter((m) => m.kind === "water" && m.recorded_on === today).reduce((s, m) => s + Number(m.value), 0),
    [metrics, today]
  );

  const weights = metrics.filter((m) => m.kind === "weight").sort((a, b) => a.recorded_on.localeCompare(b.recorded_on));
  const lastWeight = weights[weights.length - 1];
  const prevWeight = weights[weights.length - 2];
  const weightDelta = lastWeight && prevWeight ? Number(lastWeight.value) - Number(prevWeight.value) : null;
  const sleepToday = metrics.find((m) => m.kind === "sleep" && m.recorded_on === today);
  const stepsToday = metrics.filter((m) => m.kind === "steps" && m.recorded_on === today).reduce((s, m) => s + Number(m.value), 0);
  const stepsGoal = 10000;

  const weekSteps = useMemo(() => buildWeek(metrics, "steps"), [metrics]);
  const weekSleep = useMemo(() => buildWeek(metrics, "sleep"), [metrics]);
  const weekStepsTotal = weekSteps.reduce((s, d) => s + d.v, 0);
  const sleepAvg = (() => {
    const xs = weekSleep.filter((d) => d.v > 0);
    return xs.length ? xs.reduce((s, d) => s + d.v, 0) / xs.length : 0;
  })();

  async function addWater(ml: number) {
    setMetrics((m) => [
      { id: "tmp" + Math.random(), kind: "water", value: ml, recorded_on: today, created_at: new Date().toISOString() },
      ...m,
    ]);
    await apiSend("/api/health", "POST", { kind: "water", value: ml, date: today });
    load();
  }

  async function delWeight(id: string) {
    setMetrics((m) => m.filter((x) => x.id !== id));
    await apiSend(`/api/health?id=${id}`, "DELETE");
    load();
  }

  if (loading) return <div className="pt-16 flex justify-center"><Spinner /></div>;

  const peakSteps = weekSteps.reduce((mx, d) => Math.max(mx, d.v), 0);

  return (
    <div className="space-y-3 pt-2">
      {/* فعالیتِ هفته — کارتِ مشکیِ راه‌راه */}
      <DarkActivityChart
        title="قدم‌های این هفته"
        value={fa(weekStepsTotal)}
        unit="قدم"
        data={weekSteps.map((d) => ({ l: d.l, v: d.v, hi: d.v > 0 && d.v === peakSteps }))}
        accent="var(--teal)"
        peakLabel={peakSteps > 0 ? fa(peakSteps) : undefined}
      />

      {/* آب و قدم‌ها — کاشی‌های پاستلی با حلقه */}
      <div className="grid grid-cols-2 gap-3">
        <StatTile tint="var(--t-blue)" label="آب امروز" value={fa(waterToday)} sub={`از ${fa(waterGoal)}ml`}
          ring={Math.min(1, waterToday / waterGoal)} ringColor="var(--blue)" />
        <StatTile tint="var(--t-peach)" label="قدم امروز" value={fa(stepsToday)} sub={`هدف ${fa(stepsGoal)}`}
          ring={Math.min(1, stepsToday / stepsGoal)} ringColor="var(--peach)" onClick={() => setSheet("steps")} />
      </div>

      {/* افزودنِ سریعِ آب */}
      <Card>
        <div className="flex items-center gap-3 mb-3">
          <IconChip icon="water" color="var(--blue)" bg="var(--t-blue)" />
          <div className="flex-1">
            <p className="t-h3">یک لیوان دیگه</p>
            <p className="t-cap mt-0.5">آب امروزت رو ثبت کن</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[200, 330, 500].map((ml) => (
            <button key={ml} onClick={() => addWater(ml)}
              className="rounded-[16px] font-bold py-3 text-[15px] active:scale-95 transition"
              style={{ background: "var(--t-blue)", color: "var(--blue-deep)" }}>
              +{fa(ml)}
            </button>
          ))}
        </div>
      </Card>

      {/* خواب — نمودار میله‌ای روشن */}
      <SectionTitle>خواب</SectionTitle>
      <Card>
        <div className="flex items-baseline gap-1.5 mb-3.5">
          <span className="num" style={{ fontSize: 26, color: "var(--ink)" }}>{sleepAvg ? fa(sleepAvg, 1) : "—"}</span>
          <span className="t-cap">میانگین شبانه (ساعت)</span>
        </div>
        <BarChart
          data={weekSleep.map((d) => ({ l: d.l, v: d.v, hi: d.v > 0 && d.v === Math.max(...weekSleep.map((x) => x.v)) }))}
          accent="var(--lav)" muted="rgba(143,134,230,0.18)" height={90} labels />
        <button onClick={() => setSheet("sleep")}
          className="mt-4 w-full rounded-[16px] font-bold py-2.5 text-[14px] active:scale-95 transition"
          style={{ background: "var(--t-lav)", color: "var(--lav)" }}>
          + ثبت خواب{sleepToday ? ` · ${fa(Number(sleepToday.value), 1)} ساعت دیشب` : ""}
        </button>
      </Card>

      {/* وزن */}
      <Card className="flex items-center gap-3 cursor-pointer" onClick={() => setSheet("weight")}>
        <IconChip icon="weight" color="var(--sage)" bg="var(--t-sage)" />
        <div className="flex-1">
          <p className="t-h3">وزن</p>
          <p className={`t-cap mt-0.5 ${weightDelta != null ? (weightDelta > 0 ? "text-ios-red" : "text-ios-green") : ""}`}>
            {weightDelta != null
              ? `${weightDelta > 0 ? "▲" : weightDelta < 0 ? "▼" : ""} ${fa(Math.abs(weightDelta), 1)} کیلو`
              : "ثبت وزن"}
          </p>
        </div>
        <p className="num" style={{ fontSize: 18, color: "var(--ink)" }}>
          {lastWeight ? fa(Number(lastWeight.value), 1) : "—"}
          <span className="t-cap" style={{ fontWeight: 500 }}> kg</span>
        </p>
      </Card>

      {weights.length >= 2 && (
        <Card>
          <p className="t-h3 mb-3">روند وزن</p>
          <WeightChart data={weights.slice(-7)} goal={profile?.weight_goal ?? undefined} />
        </Card>
      )}

      {weights.length >= 1 && (
        <Card>
          <p className="t-h3 mb-3">وزن‌های ثبت‌شده</p>
          <WeightHistory weights={weights} onDelete={delWeight} />
        </Card>
      )}

      <MetricSheet kind={sheet} onClose={() => setSheet(null)} date={today} onAdded={load} />
    </div>
  );
}

function buildWeek(metrics: HealthMetric[], kind: HealthMetric["kind"]): { l: string; v: number }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = daysAgoISO(6 - i);
    const v = kind === "sleep"
      ? Number(metrics.find((m) => m.kind === "sleep" && m.recorded_on === date)?.value ?? 0)
      : metrics.filter((m) => m.kind === kind && m.recorded_on === date).reduce((s, m) => s + Number(m.value), 0);
    return { l: jWeekday(date), v };
  });
}

function MetricSheet({ kind, onClose, date, onAdded }: { kind: null | "weight" | "sleep" | "steps"; onClose: () => void; date: string; onAdded: () => void }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const meta = {
    weight: { title: "ثبت وزن", label: "وزن (کیلوگرم)", ph: "۷۲٫۵" },
    sleep: { title: "ثبت خواب", label: "ساعت خواب", ph: "۷٫۵" },
    steps: { title: "ثبت قدم", label: "تعداد قدم", ph: "۸۰۰۰" },
  } as const;

  async function submit() {
    if (!value || !kind) return;
    setBusy(true);
    try {
      await apiSend("/api/health", "POST", { kind, value: parseNum(value), date });
      setValue(""); onAdded(); onClose();
    } finally { setBusy(false); }
  }

  return (
    <Sheet open={!!kind} onClose={onClose} title={kind ? meta[kind].title : ""}>
      {kind && (
        <div className="space-y-3">
          <Field label={meta[kind].label}>
            <input className="ios-input text-center text-[22px] font-bold" inputMode="decimal"
              value={value} onChange={(e) => setValue(e.target.value)} placeholder={meta[kind].ph} autoFocus />
          </Field>
          <Button onClick={submit} disabled={busy || !value} className="w-full flex items-center justify-center gap-2">
            {busy && <Spinner />} ثبت
          </Button>
        </div>
      )}
    </Sheet>
  );
}

function WeightChart({ data, goal }: { data: HealthMetric[]; goal?: number }) {
  const vals = data.map((d) => Number(d.value));
  const min = Math.min(...vals, goal ?? Infinity) - 1;
  const max = Math.max(...vals, goal ?? -Infinity) + 1;
  const range = max - min || 1;
  const W = 300, H = 90;
  const step = data.length > 1 ? W / (data.length - 1) : W;
  const pts = data.map((d, i) => {
    const x = i * step;
    const y = H - ((Number(d.value) - min) / range) * H;
    return [x, y] as const;
  });
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const goalY = goal != null ? H - ((goal - min) / range) * H : null;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: 90 }}>
        {goalY != null && <line x1="0" y1={goalY} x2={W} y2={goalY} stroke="#6fa386" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.7" />}
        <path d={path} fill="none" stroke="#1f6ca6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill="#1f6ca6" />)}
      </svg>
      <div className="flex justify-between mt-1">
        {data.map((d) => <span key={d.id} className="secondary text-[10px]">{jWeekday(d.recorded_on)}</span>)}
      </div>
    </div>
  );
}

function WeightHistory({ weights, onDelete }: { weights: HealthMetric[]; onDelete: (id: string) => void }) {
  // weights صعودی است؛ برای نمایش، جدیدترین بالا و تغییرِ هر رکورد نسبت به رکوردِ قبل‌ترش محاسبه می‌شود.
  const rows = weights
    .map((w, i) => ({ w, delta: i > 0 ? Number(w.value) - Number(weights[i - 1].value) : null }))
    .reverse();

  return (
    <div className="space-y-1 max-h-[260px] overflow-y-auto -mx-1">
      {rows.map(({ w, delta }) => (
        <div key={w.id} className="flex items-center gap-3 px-1 py-2 border-b border-[var(--sep)] last:border-0">
          <span className="t-cap flex-1">{jDateShort(w.recorded_on)}</span>
          {delta != null && delta !== 0 && (
            <span className={`text-[12px] num ${delta > 0 ? "text-ios-red" : "text-ios-green"}`}>
              {delta > 0 ? "▲" : "▼"} {fa(Math.abs(delta), 1)}
            </span>
          )}
          <span className="num" style={{ fontSize: 16, color: "var(--ink)" }}>
            {fa(Number(w.value), 1)}<span className="t-cap" style={{ fontWeight: 500 }}> kg</span>
          </span>
          <button onClick={() => onDelete(w.id)} className="text-ios-red/70 active:opacity-50 text-[20px] leading-none px-1">×</button>
        </div>
      ))}
    </div>
  );
}
