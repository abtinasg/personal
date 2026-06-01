"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, apiSend } from "@/lib/client";
import { fa, todayISO } from "@/lib/format";
import type { Meal, Profile } from "@/lib/types";
import { Card, Ring, Sheet, Field, Button, Spinner, EmptyState, Segmented, SectionTitle } from "@/components/ui";
import { AppIcon } from "@/components/AppIcon";

const MEAL_LABELS: Record<string, string> = {
  breakfast: "صبحانه",
  lunch: "ناهار",
  dinner: "شام",
  snack: "میان‌وعده",
};

export default function CaloriesView({ profile, onProfileChange }: { profile: Profile | null; onProfileChange?: () => void }) {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportErr, setReportErr] = useState("");
  const today = todayISO();

  const load = useCallback(async () => {
    const { meals } = await apiGet<{ meals: Meal[] }>(`/api/meals?date=${today}`);
    setMeals(meals);
    setLoading(false);
  }, [today]);

  useEffect(() => {
    load();
  }, [load]);

  const goal = profile?.daily_calorie_goal || 2000;
  const consumed = meals.reduce((s, m) => s + m.calories, 0);
  const remaining = goal - consumed;
  const macro = meals.reduce(
    (a, m) => ({ p: a.p + Number(m.protein), c: a.c + Number(m.carbs), f: a.f + Number(m.fat) }),
    { p: 0, c: 0, f: 0 }
  );

  async function genReport() {
    setReportErr("");
    setReportBusy(true);
    try {
      const { report } = await apiGet<{ report: string }>(`/api/meals/report?date=${today}`);
      setReport(report);
    } catch (e) {
      setReportErr(e instanceof Error ? e.message : "خطا در تهیه گزارش.");
    } finally {
      setReportBusy(false);
    }
  }

  async function remove(id: string) {
    setMeals((m) => m.filter((x) => x.id !== id));
    setReport(null);
    await apiSend(`/api/meals?id=${id}`, "DELETE");
  }

  return (
    <div className="space-y-3">
      <SectionTitle action={<AddButton onClick={() => setOpen(true)} />}>کالری امروز</SectionTitle>

      <Card className="flex items-center gap-5">
        <Ring progress={consumed / goal} color="#fb9a5b" size={132} stroke={14}>
          <span className="text-[30px] font-extrabold leading-none">{fa(consumed)}</span>
          <span className="secondary text-[12px] mt-1">از {fa(goal)}</span>
        </Ring>
        <div className="flex-1 space-y-2">
          <Stat label="باقی‌مانده" value={`${fa(Math.abs(remaining))} کالری`} tone={remaining < 0 ? "red" : "green"} hint={remaining < 0 ? "بیشتر از هدف" : "تا هدف"} />
          <div className="grid grid-cols-3 gap-2 pt-1">
            <Macro label="پروتئین" v={macro.p} color="#5b76f0" />
            <Macro label="کربو" v={macro.c} color="#fb9a5b" />
            <Macro label="چربی" v={macro.f} color="#fb7fa0" />
          </div>
        </div>
      </Card>

      <Card onClick={() => setPlanOpen(true)} className="flex items-center gap-3">
        <span className="h-11 w-11 rounded-2xl bg-ios-green/15 text-ios-green flex items-center justify-center shrink-0"><AppIcon name="calculator" size={22} /></span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[16px]">برنامه‌ی هوشمند تغذیه</p>
          <p className="secondary text-[13px]">BMI، کالری هدف و درشت‌مغذی‌ها بر اساس بدن و ماموریتت</p>
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--secondary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 rotate-180">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </Card>

      {meals.length > 0 && (
        <Card className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-ios-indigo shrink-0"><AppIcon name="sparkles" size={20} /></span>
              <p className="font-semibold truncate">گزارش هوش مصنوعی</p>
            </div>
            <Button
              variant="ghost"
              onClick={genReport}
              disabled={reportBusy}
              className="!py-1.5 !px-3.5 !text-[14px] flex items-center gap-2 whitespace-nowrap"
            >
              {reportBusy && <Spinner className="!h-4 !w-4" />}
              {report ? "به‌روزرسانی" : "تهیه گزارش"}
            </Button>
          </div>
          {reportErr && <p className="text-ios-red text-[13px] px-1">{reportErr}</p>}
          {report ? (
            <p className="text-[15px] leading-7 whitespace-pre-wrap">{report}</p>
          ) : (
            !reportBusy && <p className="secondary text-[14px]">یک تحلیل کوتاه از تغذیه‌ی امروزت بگیر.</p>
          )}
        </Card>
      )}

      {loading ? (
        <Card className="flex justify-center py-8"><Spinner /></Card>
      ) : meals.length === 0 ? (
        <Card><EmptyState icon="meal" title="هنوز چیزی ثبت نکردی" sub="اولین وعده‌ت رو با دکمه‌ی + اضافه کن" /></Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          {meals.map((m) => (
            <div key={m.id} className="hairline flex items-center gap-3 px-4 py-3">
              <span className="text-ios-orange shrink-0"><AppIcon name={m.meal_type} size={24} /></span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{m.name}</p>
                <p className="secondary text-[13px]">{MEAL_LABELS[m.meal_type]}</p>
              </div>
              <span className="font-bold text-ios-orange whitespace-nowrap">{fa(m.calories)} کcal</span>
              <button onClick={() => remove(m.id)} className="text-ios-red/70 active:opacity-50 text-[20px] leading-none px-1">×</button>
            </div>
          ))}
        </Card>
      )}

      <AddMealSheet open={open} onClose={() => setOpen(false)} date={today} onAdded={load} />
      <NutritionPlanSheet open={planOpen} onClose={() => setPlanOpen(false)} profile={profile} onProfileChange={onProfileChange} />
    </div>
  );
}

type Metrics = { bmi: number; bmi_label: string; bmr: number; tdee: number; age: number; weight: number; height: number; avg_daily_calories: number };
type Plan = { recommended_calories: number; target_weight: number | null; protein_g: number; carb_g: number; fat_g: number; summary: string; patterns: string; tips: string[] };

const ACTIVITY_OPTS = [
  { value: "sedentary", label: "کم‌تحرک" },
  { value: "light", label: "سبک" },
  { value: "moderate", label: "متوسط" },
  { value: "active", label: "پرتحرک" },
  { value: "very_active", label: "خیلی‌زیاد" },
] as const;

function NutritionPlanSheet({
  open,
  onClose,
  profile,
  onProfileChange,
}: {
  open: boolean;
  onClose: () => void;
  profile: Profile | null;
  onProfileChange?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [needs, setNeeds] = useState<string[] | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState(false);
  const [applied, setApplied] = useState(false);

  // فرم مشخصات بدنی
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [sex, setSex] = useState<"male" | "female">("male");
  const [birthYear, setBirthYear] = useState("");
  const [activity, setActivity] = useState<string>("light");
  const [savingForm, setSavingForm] = useState(false);

  const fetchPlan = useCallback(async () => {
    setLoading(true); setErr(""); setApplied(false);
    try {
      const res = await apiGet<{ needs?: string[]; metrics?: Metrics; plan?: Plan }>("/api/coach/nutrition");
      if (res.needs?.length) {
        setNeeds(res.needs);
        setMetrics(null); setPlan(null);
        setEditing(true);
      } else {
        setNeeds(null);
        setMetrics(res.metrics || null);
        setPlan(res.plan || null);
        setEditing(false);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "خطا در دریافت برنامه.");
    } finally {
      setLoading(false);
    }
  }, []);

  // فقط هنگام «باز شدن» شیت مقداردهی و واکشی کن؛ نه با هر تغییر پروفایل
  // (در غیر این صورت اعمال‌کردن هدف، خودش باعث واکشی دوباره و پریدنِ وضعیت می‌شد).
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setHeight(profile?.height_cm ? String(profile.height_cm) : "");
      setSex(profile?.sex === "female" ? "female" : "male");
      setBirthYear(profile?.birth_year ? String(profile.birth_year) : "");
      setActivity(profile?.activity_level || "light");
      setWeight("");
      fetchPlan();
    }
    wasOpen.current = open;
  }, [open, profile, fetchPlan]);

  async function saveForm() {
    if (!height || !birthYear) { setErr("قد و سال تولد لازم است."); return; }
    setSavingForm(true); setErr("");
    try {
      await apiSend("/api/profile", "PUT", {
        height_cm: Number(height),
        sex,
        birth_year: Number(birthYear),
        activity_level: activity,
      });
      if (weight) await apiSend("/api/health", "POST", { kind: "weight", value: Number(weight) });
      onProfileChange?.();
      await fetchPlan();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "خطا در ذخیره‌ی مشخصات.");
    } finally {
      setSavingForm(false);
    }
  }

  async function apply() {
    if (!plan) return;
    await apiSend("/api/profile", "PUT", {
      daily_calorie_goal: plan.recommended_calories,
      ...(plan.target_weight != null ? { weight_goal: plan.target_weight } : {}),
    });
    onProfileChange?.();
    setApplied(true);
  }

  const NEED_FA: Record<string, string> = { weight: "وزن", height_cm: "قد", sex: "جنسیت", birth_year: "سال تولد" };

  const currentGoal = profile?.daily_calorie_goal || 0;
  const synced = applied || (plan != null && currentGoal === plan.recommended_calories);

  return (
    <Sheet open={open} onClose={onClose} title="برنامه‌ی هوشمند تغذیه">
      {loading ? (
        <div className="py-10 flex justify-center"><Spinner /></div>
      ) : editing ? (
        <div className="space-y-3">
          {needs?.length ? (
            <p className="secondary text-[14px] leading-relaxed px-1">
              برای محاسبه‌ی دقیق، این‌ها رو لازم دارم: {needs.map((n) => NEED_FA[n] || n).join("، ")}.
            </p>
          ) : (
            <p className="secondary text-[14px] px-1">مشخصات بدنی‌ات رو به‌روز کن.</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Field label="وزن فعلی (kg)"><input className="ios-input" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="۷۵" /></Field>
            <Field label="قد (cm)"><input className="ios-input" inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="۱۷۵" /></Field>
          </div>
          <Field label="سال تولد (میلادی)">
            <input className="ios-input" inputMode="numeric" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} placeholder="۱۹۹۵" />
          </Field>
          <Field label="جنسیت">
            <Segmented value={sex} onChange={setSex} options={[{ value: "male", label: "مرد" }, { value: "female", label: "زن" }]} />
          </Field>
          <Field label="سطح فعالیت">
            <Segmented value={activity} onChange={setActivity} options={ACTIVITY_OPTS.map((o) => ({ value: o.value, label: o.label }))} />
          </Field>
          {err && <p className="text-ios-red text-[13px] px-1">{err}</p>}
          <Button onClick={saveForm} disabled={savingForm} className="w-full flex items-center justify-center gap-2">
            {savingForm && <Spinner />} محاسبه‌ی برنامه
          </Button>
        </div>
      ) : metrics && plan ? (
        <div className="space-y-3 pb-2">
          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="BMI" value={fa(metrics.bmi, 1)} hint={metrics.bmi_label} />
            <MiniStat label="سوخت‌وساز پایه" value={fa(metrics.bmr)} hint="BMR" />
            <MiniStat label="نیاز روزانه" value={fa(metrics.tdee)} hint="TDEE" />
          </div>

          <Card className="!p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="secondary text-[13px]">کالری هدفِ پیشنهادی</p>
                <p className="text-[26px] font-extrabold text-ios-green leading-tight">{fa(plan.recommended_calories)} <span className="text-[14px] secondary">کالری/روز</span></p>
                <p className="secondary text-[12px] mt-0.5">
                  {synced
                    ? "هماهنگ با هدفِ تنظیمات"
                    : currentGoal > 0
                      ? `هدفِ فعلی در تنظیمات: ${fa(currentGoal)} کالری`
                      : "هنوز هدفی در تنظیمات ثبت نشده"}
                </p>
              </div>
              {plan.target_weight != null && (
                <div className="text-center">
                  <p className="secondary text-[12px]">وزن هدف</p>
                  <p className="text-[20px] font-bold">{fa(plan.target_weight, 1)} kg</p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1">
              <Macro label="پروتئین (گ)" v={plan.protein_g} color="#5b76f0" />
              <Macro label="کربو (گ)" v={plan.carb_g} color="#fb9a5b" />
              <Macro label="چربی (گ)" v={plan.fat_g} color="#fb7fa0" />
            </div>
          </Card>

          {plan.summary && <p className="text-[15px] leading-7">{plan.summary}</p>}

          {plan.patterns && (
            <Card className="!p-4">
              <p className="font-semibold text-[14px] mb-1 flex items-center gap-1.5"><AppIcon name="chart" size={15} /> الگوی خوراکت</p>
              <p className="text-[14px] leading-7 secondary">{plan.patterns}</p>
            </Card>
          )}

          {plan.tips.length > 0 && (
            <div className="space-y-1.5">
              {plan.tips.map((t, i) => (
                <div key={i} className="flex gap-2 text-[14px] leading-6">
                  <span className="text-ios-green">✓</span>
                  <span>{t}</span>
                </div>
              ))}
            </div>
          )}

          {err && <p className="text-ios-red text-[13px] px-1">{err}</p>}

          <div className="flex gap-2 pt-1">
            <Button variant="ghost" onClick={() => setEditing(true)} className="flex-1 !text-[14px]">ویرایش مشخصات</Button>
            <Button onClick={apply} disabled={synced} className="flex-[2] flex items-center justify-center gap-2">
              {synced ? <><AppIcon name="check" size={16} /> هماهنگ با اهداف</> : "اعمال روی اهداف"}
            </Button>
          </div>
        </div>
      ) : (
        err && <p className="text-ios-red text-[14px] px-1 py-6">{err}</p>
      )}
    </Sheet>
  );
}

function MiniStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-black/[0.03] dark:bg-white/[0.05] py-3 text-center">
      <p className="secondary text-[11px]">{label}</p>
      <p className="font-extrabold text-[18px] leading-tight">{value}</p>
      {hint && <p className="secondary text-[10px]">{hint}</p>}
    </div>
  );
}

function AddMealSheet({ open, onClose, date, onAdded }: { open: boolean; onClose: () => void; date: string; onAdded: () => void }) {
  const [name, setName] = useState("");
  const [cal, setCal] = useState("");
  const [type, setType] = useState<Meal["meal_type"]>("snack");
  const [p, setP] = useState("");
  const [c, setC] = useState("");
  const [f, setF] = useState("");
  const [busy, setBusy] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [estimated, setEstimated] = useState(false);
  const [err, setErr] = useState("");

  function reset() {
    setName(""); setCal(""); setP(""); setC(""); setF(""); setType("snack");
    setEstimated(false); setErr("");
  }

  async function estimate() {
    if (!name.trim() || estimating) return;
    setErr("");
    setEstimating(true);
    try {
      const { estimate } = await apiSend<{
        estimate: { name: string; calories: number; protein: number; carbs: number; fat: number; meal_type: Meal["meal_type"] };
      }>("/api/meals/estimate", "POST", { description: name });
      setName(estimate.name);
      setCal(String(estimate.calories));
      setP(String(estimate.protein));
      setC(String(estimate.carbs));
      setF(String(estimate.fat));
      setType(estimate.meal_type);
      setEstimated(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "خطا در تخمین کالری.");
    } finally {
      setEstimating(false);
    }
  }

  async function submit() {
    if (!name.trim() || !cal) return;
    setBusy(true);
    try {
      await apiSend("/api/meals", "POST", {
        name, calories: Number(cal), meal_type: type,
        protein: Number(p) || 0, carbs: Number(c) || 0, fat: Number(f) || 0, date,
      });
      reset();
      onAdded();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="افزودن وعده">
      <div className="space-y-3">
        <Segmented
          value={type}
          onChange={setType}
          options={[
            { value: "breakfast", label: "صبحانه" },
            { value: "lunch", label: "ناهار" },
            { value: "dinner", label: "شام" },
            { value: "snack", label: "میان‌وعده" },
          ]}
        />
        <Field label="چی خوردی؟">
          <input
            className="ios-input"
            value={name}
            onChange={(e) => { setName(e.target.value); setEstimated(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") estimate(); }}
            placeholder="مثلاً دو تخم‌مرغ آب‌پز و یک نان سنگک"
          />
        </Field>
        <Button
          variant="ghost"
          onClick={estimate}
          disabled={estimating || !name.trim()}
          className="w-full flex items-center justify-center gap-2"
        >
          {estimating ? <><Spinner /> در حال تخمین…</> : <><AppIcon name="sparkles" size={18} /> تخمین هوشمند کالری</>}
        </Button>
        {err && <p className="text-ios-red text-[13px] px-1">{err}</p>}
        <Field label="کالری">
          <input className="ios-input" inputMode="numeric" value={cal} onChange={(e) => { setCal(e.target.value); setEstimated(false); }} placeholder="۴۵۰" />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="پروتئین (گ)"><input className="ios-input" inputMode="numeric" value={p} onChange={(e) => setP(e.target.value)} placeholder="۰" /></Field>
          <Field label="کربو (گ)"><input className="ios-input" inputMode="numeric" value={c} onChange={(e) => setC(e.target.value)} placeholder="۰" /></Field>
          <Field label="چربی (گ)"><input className="ios-input" inputMode="numeric" value={f} onChange={(e) => setF(e.target.value)} placeholder="۰" /></Field>
        </div>
        {estimated && (
          <p className="secondary text-[12px] px-1 flex items-center gap-1.5"><AppIcon name="sparkles" size={13} /> این عددها تخمین هوش مصنوعی‌ان — اگه خواستی دستی ویرایش کن.</p>
        )}
        <Button onClick={submit} disabled={busy || !name.trim() || !cal} className="w-full flex items-center justify-center gap-2 mt-1">
          {busy && <Spinner />} افزودن
        </Button>
      </div>
    </Sheet>
  );
}

export function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="h-9 w-9 rounded-full bg-ios-blue text-white text-[22px] leading-none flex items-center justify-center shadow-card active:scale-90 transition">
      +
    </button>
  );
}

function Stat({ label, value, tone, hint }: { label: string; value: string; tone?: "red" | "green"; hint?: string }) {
  return (
    <div>
      <p className="secondary text-[13px]">{label}</p>
      <p className={`text-[20px] font-bold ${tone === "red" ? "text-ios-red" : tone === "green" ? "text-ios-green" : ""}`}>{value}</p>
      {hint && <p className="secondary text-[11px]">{hint}</p>}
    </div>
  );
}

function Macro({ label, v, color }: { label: string; v: number; color: string }) {
  return (
    <div className="text-center rounded-xl bg-black/[0.03] dark:bg-white/[0.05] py-2">
      <p className="font-bold text-[15px]" style={{ color }}>{fa(Math.round(v))}</p>
      <p className="secondary text-[11px]">{label}</p>
    </div>
  );
}
