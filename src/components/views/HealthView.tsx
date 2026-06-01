"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiSend } from "@/lib/client";
import { fa, todayISO, daysAgoISO, jWeekday } from "@/lib/format";
import type { HealthMetric, Profile } from "@/lib/types";
import { Card, Ring, Sheet, Field, Button, Spinner, SectionTitle } from "@/components/ui";
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

  useEffect(() => {
    load();
  }, [load]);

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

  async function addWater(ml: number) {
    setMetrics((m) => [
      { id: "tmp" + Math.random(), kind: "water", value: ml, recorded_on: today, created_at: new Date().toISOString() },
      ...m,
    ]);
    await apiSend("/api/health", "POST", { kind: "water", value: ml, date: today });
    load();
  }

  if (loading) return <div className="pt-16 flex justify-center"><Spinner /></div>;

  return (
    <div className="space-y-3">
      <SectionTitle>سلامتی</SectionTitle>

      {/* آب */}
      <Card className="flex items-center gap-5">
        <Ring progress={waterToday / waterGoal} color="#2cb8cf" size={132} stroke={14}>
          <span className="text-ios-teal"><AppIcon name="water" size={24} /></span>
          <span className="text-[18px] font-extrabold leading-none mt-1">{fa(waterToday)}</span>
          <span className="secondary text-[11px]">از {fa(waterGoal)}ml</span>
        </Ring>
        <div className="flex-1">
          <p className="font-bold mb-2">آب امروز</p>
          <div className="grid grid-cols-3 gap-2">
            {[200, 330, 500].map((ml) => (
              <button
                key={ml}
                onClick={() => addWater(ml)}
                className="rounded-xl bg-ios-teal/10 text-ios-teal font-bold py-3 text-[15px] active:scale-95 transition"
              >
                +{fa(ml)}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          icon="weight"
          title="وزن"
          main={lastWeight ? `${fa(Number(lastWeight.value), 1)}` : "—"}
          unit={lastWeight ? "kg" : ""}
          hint={
            weightDelta != null
              ? `${weightDelta > 0 ? "▲" : weightDelta < 0 ? "▼" : ""} ${fa(Math.abs(weightDelta), 1)} kg`
              : "ثبت وزن"
          }
          hintTone={weightDelta != null ? (weightDelta > 0 ? "red" : "green") : undefined}
          onAdd={() => setSheet("weight")}
        />
        <MetricCard
          icon="sleep"
          title="خواب دیشب"
          main={sleepToday ? fa(Number(sleepToday.value), 1) : "—"}
          unit={sleepToday ? "ساعت" : ""}
          hint="ثبت خواب"
          onAdd={() => setSheet("sleep")}
        />
      </div>

      <MetricCard
        wide
        icon="steps"
        title="قدم امروز"
        main={fa(stepsToday)}
        unit="قدم"
        hint="افزودن قدم"
        onAdd={() => setSheet("steps")}
      />

      {/* روند وزن */}
      {weights.length >= 2 && (
        <Card>
          <p className="font-bold mb-3">روند وزن</p>
          <WeightChart data={weights.slice(-7)} goal={profile?.weight_goal ?? undefined} />
        </Card>
      )}

      <MetricSheet kind={sheet} onClose={() => setSheet(null)} date={today} onAdded={load} />
    </div>
  );
}

function MetricCard({
  icon, title, main, unit, hint, hintTone, onAdd, wide,
}: {
  icon: string; title: string; main: string; unit: string; hint: string;
  hintTone?: "red" | "green"; onAdd: () => void; wide?: boolean;
}) {
  return (
    <Card className={`${wide ? "" : ""} relative`} onClick={onAdd}>
      <div className="flex items-start justify-between">
        <span className="text-ios-blue"><AppIcon name={icon} size={24} /></span>
        <span className="h-7 w-7 rounded-full bg-ios-blue/10 text-ios-blue flex items-center justify-center text-[18px] leading-none">+</span>
      </div>
      <p className="secondary text-[13px] mt-2">{title}</p>
      <p className="font-extrabold text-[26px] leading-tight">
        {main} <span className="text-[14px] secondary font-medium">{unit}</span>
      </p>
      <p className={`text-[12px] ${hintTone === "red" ? "text-ios-red" : hintTone === "green" ? "text-ios-green" : "secondary"}`}>{hint}</p>
    </Card>
  );
}

function MetricSheet({
  kind, onClose, date, onAdded,
}: {
  kind: null | "weight" | "sleep" | "steps"; onClose: () => void; date: string; onAdded: () => void;
}) {
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
      await apiSend("/api/health", "POST", { kind, value: Number(value), date });
      setValue("");
      onAdded();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={!!kind} onClose={onClose} title={kind ? meta[kind].title : ""}>
      {kind && (
        <div className="space-y-3">
          <Field label={meta[kind].label}>
            <input
              className="ios-input text-center text-[22px] font-bold"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={meta[kind].ph}
              autoFocus
            />
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
        {goalY != null && (
          <line x1="0" y1={goalY} x2={W} y2={goalY} stroke="#22c391" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.7" />
        )}
        <path d={path} fill="none" stroke="#5b76f0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill="#5b76f0" />
        ))}
      </svg>
      <div className="flex justify-between mt-1">
        {data.map((d) => (
          <span key={d.id} className="secondary text-[10px]">{jWeekday(d.recorded_on)}</span>
        ))}
      </div>
    </div>
  );
}
