"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/client";
import { fa } from "@/lib/format";
import type {
  WorkoutPlan,
  WorkoutBlock,
  WorkoutBlockKind,
  FitnessGoal,
  FitnessLevel,
  WorkoutLocation,
} from "@/lib/types";
import { Card, Sheet, Field, Button, Spinner, SectionTitle, EmptyState, Segmented } from "@/components/ui";
import { AppIcon } from "@/components/AppIcon";

type Prefs = {
  fitness_goal: FitnessGoal | null;
  fitness_level: FitnessLevel | null;
  workout_days: number | null;
  workout_location: WorkoutLocation | null;
  workout_equipment: string | null;
  workout_minutes: number | null;
  workout_limits: string | null;
};

const GOAL_OPTS: { value: FitnessGoal; label: string }[] = [
  { value: "lose_fat", label: "کاهش چربی" },
  { value: "build_muscle", label: "عضله‌سازی" },
  { value: "strength", label: "قدرت" },
  { value: "endurance", label: "استقامت" },
  { value: "general", label: "آمادگی عمومی" },
];
const LEVEL_OPTS: { value: FitnessLevel; label: string }[] = [
  { value: "beginner", label: "مبتدی" },
  { value: "intermediate", label: "متوسط" },
  { value: "advanced", label: "پیشرفته" },
];
const LOCATION_OPTS: { value: WorkoutLocation; label: string }[] = [
  { value: "gym", label: "باشگاه" },
  { value: "home", label: "خانه" },
  { value: "outdoor", label: "فضای باز" },
];

const GOAL_FA = Object.fromEntries(GOAL_OPTS.map((o) => [o.value, o.label])) as Record<string, string>;
const LEVEL_FA = Object.fromEntries(LEVEL_OPTS.map((o) => [o.value, o.label])) as Record<string, string>;
const LOCATION_FA = Object.fromEntries(LOCATION_OPTS.map((o) => [o.value, o.label])) as Record<string, string>;

const KIND_META: Record<WorkoutBlockKind, { label: string; icon: string; color: string }> = {
  warmup: { label: "گرم‌کردن", icon: "sun", color: "#ef9d63" },
  strength: { label: "قدرتی", icon: "strength", color: "#16517d" },
  aerobic: { label: "هوازی", icon: "run", color: "#3aa6b8" },
  cooldown: { label: "سردکردن و کشش", icon: "calm", color: "#1f6ca6" },
};

const HERO_GRADIENT = "linear-gradient(135deg,#1f6ca6,#3aa6b8)";

export default function WorkoutView() {
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [needs, setNeeds] = useState<string[]>([]);
  const [hasBody, setHasBody] = useState(true);
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState("");
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiGet<{ prefs: Prefs; needs: string[]; has_body: boolean; plan: WorkoutPlan | null }>(
        "/api/coach/workout"
      );
      setPrefs(res.prefs);
      setNeeds(res.needs || []);
      setHasBody(res.has_body);
      setPlan(res.plan);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "خطا در دریافت اطلاعات.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const generate = useCallback(async () => {
    setErr("");
    setGenerating(true);
    try {
      const res = await apiSend<{ plan?: WorkoutPlan; needs?: string[] }>("/api/coach/workout", "POST");
      if (res.needs?.length) {
        setNeeds(res.needs);
        setEditOpen(true);
      } else if (res.plan) {
        setPlan(res.plan);
        setNeeds([]);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "ساخت برنامه با خطا روبه‌رو شد.");
    } finally {
      setGenerating(false);
    }
  }, []);

  async function toggleDone() {
    if (!plan) return;
    const next = !plan.completed;
    setPlan({ ...plan, completed: next });
    try {
      await apiSend("/api/coach/workout", "PUT", { completed: next });
    } catch {
      setPlan({ ...plan, completed: !next });
    }
  }

  const setupDone = needs.length === 0 && prefs?.fitness_goal;

  if (loading) return <div className="pt-16 flex justify-center"><Spinner /></div>;

  return (
    <div className="space-y-3">
      <SectionTitle>برنامه‌ی ورزشی</SectionTitle>

      {/* پرسش‌نامه‌ی اولیه */}
      {!setupDone ? (
        <Card className="text-center py-8 px-5">
          <div className="mx-auto mb-3 h-16 w-16 rounded-[22px] flex items-center justify-center text-white" style={{ backgroundImage: HERO_GRADIENT }}>
            <AppIcon name="strength" size={30} />
          </div>
          <p className="text-[19px] font-bold">مربیِ هوشمندت رو راه‌اندازی کن</p>
          <p className="secondary text-[14px] leading-7 mt-1 px-2">
            چند تا سوالِ کوتاه درباره‌ی هدف و وضعیتت می‌پرسم، بعد هر روز یک برنامه‌ی تمرینیِ هوازی و قدرتیِ اختصاصی برات می‌سازم.
          </p>
          <Button onClick={() => setEditOpen(true)} className="w-full mt-5">شروع</Button>
        </Card>
      ) : (
        <>
          {/* وضعیتِ کلی */}
          <Card className="flex items-center gap-3 !py-3">
            <span className="h-10 w-10 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "#16517d22", color: "#16517d" }}>
              <AppIcon name="target" size={20} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[15px] truncate">
                {GOAL_FA[prefs!.fitness_goal!]} · {LEVEL_FA[prefs!.fitness_level!]}
              </p>
              <p className="secondary text-[12px] truncate">
                {LOCATION_FA[prefs!.workout_location!]} · {fa(prefs!.workout_minutes || 45)} دقیقه · {fa(prefs!.workout_days || 3)} روز در هفته
              </p>
            </div>
            <button onClick={() => setEditOpen(true)} className="text-ios-blue text-[14px] font-medium active:opacity-60 shrink-0">ویرایش</button>
          </Card>

          {err && <p className="text-ios-red text-[13px] px-1">{err}</p>}

          {plan ? (
            <PlanView plan={plan} onToggleDone={toggleDone} onRegenerate={generate} regenerating={generating} />
          ) : (
            <Card className="text-center py-8 px-5">
              <div className="mx-auto mb-3 h-14 w-14 rounded-[20px] flex items-center justify-center text-white" style={{ backgroundImage: HERO_GRADIENT }}>
                <AppIcon name="sparkles" size={26} />
              </div>
              <p className="text-[18px] font-bold">برنامه‌ی امروزت آماده‌ست؟</p>
              <p className="secondary text-[14px] leading-7 mt-1">با یک لمس، تمرینِ امروزت رو می‌سازم.</p>
              {!hasBody && (
                <p className="secondary text-[12px] leading-6 mt-2 px-2">
                  نکته: اگه وزن و قدت رو در بخشِ سلامتی ثبت کنی، برنامه دقیق‌تر می‌شه.
                </p>
              )}
              <Button onClick={generate} disabled={generating} className="w-full mt-5 flex items-center justify-center gap-2">
                {generating ? <><Spinner /> در حال ساخت…</> : <><AppIcon name="sparkles" size={18} /> ساختِ برنامه‌ی امروز</>}
              </Button>
            </Card>
          )}
        </>
      )}

      <PrefsSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        prefs={prefs}
        onSaved={async () => {
          setEditOpen(false);
          await load();
          await generate();
        }}
      />
    </div>
  );
}

function PlanView({
  plan,
  onToggleDone,
  onRegenerate,
  regenerating,
}: {
  plan: WorkoutPlan;
  onToggleDone: () => void;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  return (
    <div className="space-y-3">
      {/* هیروی برنامه */}
      <div className="rounded-3xl p-5 text-white shadow-card" style={{ backgroundImage: HERO_GRADIENT }}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-semibold bg-white/20 rounded-full px-3 py-1">تمرینِ امروز</span>
          <span className="text-[12px] font-semibold bg-white/20 rounded-full px-3 py-1">شدت: {plan.intensity}</span>
        </div>
        <p className="text-[22px] font-extrabold mt-3 leading-tight">{plan.focus}</p>
        {plan.headline && <p className="text-[15px] opacity-95 mt-1 leading-7">{plan.headline}</p>}
        <div className="flex items-center gap-4 mt-3 text-[13px] opacity-95">
          <span className="flex items-center gap-1.5"><AppIcon name="duration" size={16} /> {fa(plan.total_minutes)} دقیقه</span>
          <span className="flex items-center gap-1.5"><AppIcon name="repeat" size={16} /> {fa(plan.blocks.length)} بخش</span>
        </div>
      </div>

      {plan.summary && <p className="text-[15px] leading-7 px-1">{plan.summary}</p>}

      {/* دکمه‌ی انجام‌شد */}
      <button
        onClick={onToggleDone}
        className={`w-full rounded-2xl py-3.5 font-bold text-[16px] flex items-center justify-center gap-2 active:scale-[0.98] transition ${
          plan.completed ? "bg-ios-green text-white" : "bg-ios-green/12 text-ios-green"
        }`}
      >
        <AppIcon name="check" size={20} />
        {plan.completed ? "امروز انجام شد! 💪" : "علامت‌زدن به‌عنوان انجام‌شده"}
      </button>

      {/* بلوک‌های تمرین */}
      {plan.blocks.map((b, i) => (
        <BlockCard key={i} block={b} />
      ))}

      {/* نکته‌های مربی */}
      {plan.coach_notes.length > 0 && (
        <Card className="!p-4">
          <p className="font-semibold text-[15px] mb-2 flex items-center gap-1.5">
            <span className="text-ios-indigo"><AppIcon name="idea" size={17} /></span> نکته‌های مربی
          </p>
          <div className="space-y-1.5">
            {plan.coach_notes.map((n, i) => (
              <div key={i} className="flex gap-2 text-[14px] leading-7">
                <span className="text-ios-indigo shrink-0">•</span>
                <span>{n}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Button
        variant="ghost"
        onClick={onRegenerate}
        disabled={regenerating}
        className="w-full flex items-center justify-center gap-2"
      >
        {regenerating ? <><Spinner /> در حال ساخت…</> : <><AppIcon name="repeat" size={18} /> ساختِ دوباره‌ی برنامه‌ی امروز</>}
      </Button>
    </div>
  );
}

function BlockCard({ block }: { block: WorkoutBlock }) {
  const meta = KIND_META[block.kind] || KIND_META.strength;
  return (
    <Card className="!p-0 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: meta.color + "12" }}>
        <span className="h-9 w-9 rounded-2xl flex items-center justify-center shrink-0" style={{ background: meta.color + "26", color: meta.color }}>
          <AppIcon name={meta.icon} size={19} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[16px] truncate" style={{ color: meta.color }}>{block.title}</p>
          <p className="secondary text-[12px]">{meta.label}{block.duration_min ? ` · ${fa(block.duration_min)} دقیقه` : ""}</p>
        </div>
      </div>
      <div>
        {block.exercises.map((ex, i) => (
          <div key={i} className="hairline px-4 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-semibold text-[15px] leading-6">{ex.name}</p>
              <span className="text-[13px] font-bold whitespace-nowrap" style={{ color: meta.color }}>
                {fa(ex.sets)} × {ex.reps}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="secondary text-[12px] flex items-center gap-1"><AppIcon name="duration" size={12} /> استراحت {ex.rest}</span>
            </div>
            {ex.note && <p className="secondary text-[12px] leading-6 mt-1">{ex.note}</p>}
          </div>
        ))}
      </div>
    </Card>
  );
}

const MINUTE_OPTS = [
  { value: "30", label: "۳۰" },
  { value: "45", label: "۴۵" },
  { value: "60", label: "۶۰" },
  { value: "90", label: "۹۰" },
];
const DAY_OPTS = [
  { value: "2", label: "۲" },
  { value: "3", label: "۳" },
  { value: "4", label: "۴" },
  { value: "5", label: "۵" },
  { value: "6", label: "۶" },
];

function ChipGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-full px-4 py-2 text-[14px] font-semibold transition active:scale-[0.97] ${
              active ? "text-white shadow-soft" : "secondary bg-[var(--label)]/[0.05]"
            }`}
            style={active ? { backgroundImage: HERO_GRADIENT } : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function PrefsSheet({
  open,
  onClose,
  prefs,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  prefs: Prefs | null;
  onSaved: () => void | Promise<void>;
}) {
  const [goal, setGoal] = useState<FitnessGoal>("general");
  const [level, setLevel] = useState<FitnessLevel>("beginner");
  const [location, setLocation] = useState<WorkoutLocation>("gym");
  const [minutes, setMinutes] = useState("45");
  const [days, setDays] = useState("3");
  const [equipment, setEquipment] = useState("");
  const [limits, setLimits] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (open) {
      setGoal(prefs?.fitness_goal || "general");
      setLevel(prefs?.fitness_level || "beginner");
      setLocation(prefs?.workout_location || "gym");
      setMinutes(String(prefs?.workout_minutes || 45));
      setDays(String(prefs?.workout_days || 3));
      setEquipment(prefs?.workout_equipment || "");
      setLimits(prefs?.workout_limits || "");
      setErr("");
    }
  }, [open, prefs]);

  const isFirstSetup = !prefs?.fitness_goal;

  async function save() {
    setSaving(true);
    setErr("");
    try {
      await apiSend("/api/profile", "PUT", {
        fitness_goal: goal,
        fitness_level: level,
        workout_location: location,
        workout_minutes: Number(minutes) || 45,
        workout_days: Number(days) || 3,
        workout_equipment: equipment.trim() || null,
        workout_limits: limits.trim() || null,
      });
      await onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "خطا در ذخیره.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="هدف و وضعیتِ ورزشی">
      <div className="space-y-4 pb-2">
        <Field label="هدفت چیه؟">
          <ChipGroup value={goal} onChange={setGoal} options={GOAL_OPTS} />
        </Field>
        <Field label="سطحت کجاست؟">
          <Segmented value={level} onChange={setLevel} options={LEVEL_OPTS} />
        </Field>
        <Field label="کجا تمرین می‌کنی؟">
          <Segmented value={location} onChange={setLocation} options={LOCATION_OPTS} />
        </Field>
        <Field label="هر جلسه چند دقیقه؟">
          <Segmented value={minutes} onChange={setMinutes} options={MINUTE_OPTS} />
        </Field>
        <Field label="هفته‌ای چند روز؟">
          <Segmented value={days} onChange={setDays} options={DAY_OPTS} />
        </Field>
        <Field label="تجهیزاتِ در دسترس (اختیاری)">
          <input className="ios-input" value={equipment} onChange={(e) => setEquipment(e.target.value)} placeholder="مثلاً دمبل و کش، یا بدون تجهیزات" />
        </Field>
        <Field label="آسیب یا محدودیت (اختیاری)">
          <input className="ios-input" value={limits} onChange={(e) => setLimits(e.target.value)} placeholder="مثلاً زانوی چپ حساسه" />
        </Field>

        {err && <p className="text-ios-red text-[13px] px-1">{err}</p>}

        <Button onClick={save} disabled={saving} className="w-full flex items-center justify-center gap-2">
          {saving && <Spinner />}
          {isFirstSetup ? "ذخیره و ساختِ برنامه" : "ذخیره و به‌روزرسانیِ برنامه"}
        </Button>
      </div>
    </Sheet>
  );
}
