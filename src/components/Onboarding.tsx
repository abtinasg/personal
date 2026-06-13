"use client";

import { useMemo, useState } from "react";
import { apiSend } from "@/lib/client";
import { fa, faDigits, parseNum } from "@/lib/format";
import { Button, Field, Segmented, Spinner, Ring } from "@/components/ui";
import { Mascot } from "@/components/Mascot";

/**
 * انبوردینگِ کاربرِ جدید — بعد از اولین ورود نشان داده می‌شود و در چند گامِ کوتاه
 * اسم و مشخصاتِ پایه‌ی بدنی را می‌گیرد، BMI را حساب می‌کند و «برنامه‌ی هوشمندِ
 * تغذیه» را برایش آماده می‌سازد. وقتی تمام شد onDone صدا زده می‌شود.
 */

const ACTIVITY_OPTS = [
  { value: "sedentary", label: "کم‌تحرک", hint: "بیشترِ روز نشسته" },
  { value: "light", label: "سبک", hint: "گاهی پیاده‌روی" },
  { value: "moderate", label: "متوسط", hint: "۳ تا ۴ روز ورزش" },
  { value: "active", label: "پرتحرک", hint: "تقریباً هر روز ورزش" },
  { value: "very_active", label: "خیلی‌زیاد", hint: "ورزشِ سنگین یا کارِ بدنی" },
] as const;

function bmiInfo(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: "پایین‌تر از محدوده", color: "var(--yellow)" };
  if (bmi < 25) return { label: "در محدودهٔ سالم", color: "var(--sage)" };
  if (bmi < 30) return { label: "کمی بالاتر از محدوده", color: "var(--peach)" };
  return { label: "بالاتر از محدوده", color: "#f08197" };
}

const STEPS = 4; // ۰:اسم، ۱:جنسیت+سال، ۲:قد+وزن، ۳:فعالیت  (گامِ نتیجه جدا)

export default function Onboarding({
  initialName,
  onDone,
}: {
  initialName: string;
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [name, setName] = useState(initialName === "" ? "" : initialName);
  const [sex, setSex] = useState<"male" | "female">("male");
  const [birthYear, setBirthYear] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [activity, setActivity] = useState<string>("light");

  const bmi = useMemo(() => {
    const h = parseNum(height);
    const w = parseNum(weight);
    if (!h || !w) return null;
    return Math.round((w / Math.pow(h / 100, 2)) * 10) / 10;
  }, [height, weight]);

  const thisYear = new Date().getFullYear();

  function valid(s: number): boolean {
    if (s === 0) return name.trim().length > 0;
    if (s === 1) {
      const y = parseNum(birthYear);
      return y >= 1900 && y <= thisYear - 5;
    }
    if (s === 2) {
      const h = parseNum(height);
      const w = parseNum(weight);
      return h >= 80 && h <= 250 && w >= 25 && w <= 400;
    }
    return true;
  }

  function next() {
    setErr("");
    if (!valid(step)) return;
    if (step < STEPS - 1) {
      setStep((s) => s + 1);
    } else {
      finish();
    }
  }

  async function finish() {
    setSaving(true);
    setErr("");
    try {
      await apiSend("/api/onboarding", "POST", {
        name: name.trim(),
        sex,
        birth_year: parseNum(birthYear),
        height_cm: parseNum(height),
        weight: parseNum(weight),
        activity_level: activity,
      });
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "خطا در ذخیره‌ی اطلاعات.");
    } finally {
      setSaving(false);
    }
  }

  // ---------- صفحه‌ی نتیجه ----------
  if (done) {
    const info = bmi != null ? bmiInfo(bmi) : { label: "", color: "var(--sage)" };
    return (
      <Screen>
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-5 animate-fade-up">
          <Mascot size={132} pose="cheer" float />
          <div>
            <h2 className="text-[24px] font-extrabold tracking-tight">{name.trim().split(" ")[0]}، اولین قدمت آماده‌ست. 🎉</h2>
            <p className="secondary text-[15px] mt-1.5 leading-7">
              برنامه‌ات رو روی این عدد چیدم — ولی این فقط یه شروعه، نه قضاوت.
            </p>
          </div>
          {bmi != null && (
            <Ring progress={Math.min(1, bmi / 40)} color={info.color} size={168} stroke={16}>
              <span className="num" style={{ fontSize: 42, color: "var(--ink)" }}>{fa(bmi, 1)}</span>
              <span className="t-cap mt-1" style={{ color: info.color, fontWeight: 700 }}>{info.label}</span>
            </Ring>
          )}
        </div>
        <Button onClick={onDone} className="w-full">بزن بریم</Button>
      </Screen>
    );
  }

  // ---------- گام‌های جمع‌آوری ----------
  return (
    <Screen>
      {/* نوارِ پیشرفت */}
      <div className="flex gap-1.5 mb-7">
        {Array.from({ length: STEPS }).map((_, i) => (
          <div
            key={i}
            className="h-1.5 flex-1 rounded-full transition-colors duration-300"
            style={{ background: i <= step ? "var(--ink)" : "var(--label)" + "26" }}
          />
        ))}
      </div>

      <div key={step} className="flex-1 animate-fade-up">
        {step === 0 && (
          <Step
            emoji="👋"
            title="سلام! اسمت چیه؟"
            sub="بذار درست و حسابی صدات کنیم."
          >
            <input
              className="ios-input text-center text-[20px] font-bold"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") next(); }}
              placeholder="مثلاً آبتین"
              autoFocus
            />
          </Step>
        )}

        {step === 1 && (
          <Step
            emoji="🧬"
            title="کمی درباره‌ی خودت"
            sub="تا برنامه‌ای بسازم که واقعاً مالِ توئه."
          >
            <Field label="جنسیت">
              <Segmented
                value={sex}
                onChange={setSex}
                options={[{ value: "male", label: "مرد" }, { value: "female", label: "زن" }]}
              />
            </Field>
            <Field label="سال تولد (میلادی)">
              <input
                className="ios-input"
                inputMode="numeric"
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") next(); }}
                placeholder="۱۹۹۵"
              />
            </Field>
          </Step>
        )}

        {step === 2 && (
          <Step
            emoji="📏"
            title="قد و وزنت چقدره؟"
            sub="پایه‌ی محاسبه‌ی BMI و برنامه‌ی غذاییه."
          >
            <div className="grid grid-cols-2 gap-2">
              <Field label="قد (سانتی‌متر)">
                <input
                  className="ios-input text-center text-[20px] font-bold"
                  inputMode="numeric"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="۱۷۵"
                  autoFocus
                />
              </Field>
              <Field label="وزن (کیلوگرم)">
                <input
                  className="ios-input text-center text-[20px] font-bold"
                  inputMode="decimal"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") next(); }}
                  placeholder="۷۵"
                />
              </Field>
            </div>
            {bmi != null && (
              <p className="secondary text-[14px] text-center mt-1">
                BMI تقریبی‌ات: <span className="font-bold" style={{ color: bmiInfo(bmi).color }}>{fa(bmi, 1)}</span>
                {"  "}({bmiInfo(bmi).label})
              </p>
            )}
          </Step>
        )}

        {step === 3 && (
          <Step
            emoji="🏃"
            title="چقدر در طول روز فعالی؟"
            sub="تا نیازِ کالری روزانه‌ات واقعی‌تر حساب بشه."
          >
            <div className="space-y-2">
              {ACTIVITY_OPTS.map((o) => {
                const active = activity === o.value;
                return (
                  <button
                    key={o.value}
                    onClick={() => setActivity(o.value)}
                    className={`w-full text-right rounded-2xl px-4 py-3.5 border transition active:scale-[0.99] ${
                      active ? "border-[var(--ink)] bg-[var(--ink)]/[0.04]" : "border-[var(--border)] bg-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-bold text-[16px]">{o.label}</p>
                        <p className="secondary text-[13px]">{o.hint}</p>
                      </div>
                      <span
                        className={`h-5 w-5 rounded-full border-2 shrink-0 flex items-center justify-center ${
                          active ? "border-[var(--ink)] bg-[var(--ink)]" : "border-[var(--label)]/40"
                        }`}
                      >
                        {active && (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        )}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </Step>
        )}
      </div>

      {err && <p className="text-ios-red text-[13px] text-center px-1 mb-2">{err}</p>}

      <div className="flex gap-2">
        {step > 0 && (
          <Button variant="ghost" onClick={() => { setErr(""); setStep((s) => s - 1); }} className="flex-1">
            قبلی
          </Button>
        )}
        <Button
          onClick={next}
          disabled={!valid(step) || saving}
          className="flex-[2] flex items-center justify-center gap-2"
        >
          {saving && <Spinner />}
          {step === STEPS - 1 ? "محاسبه و پایان" : "ادامه"}
        </Button>
      </div>

      {step === 0 && (
        <button
          type="button"
          onClick={onDone}
          className="w-full text-center secondary text-[14px] font-semibold mt-3 py-2 active:opacity-60 transition-opacity"
        >
          بزن بریم رایگان ←
        </button>
      )}

      {step > 0 && (
        <p className="secondary text-[12px] text-center mt-3">
          گامِ {faDigits(step + 1)} از {faDigits(STEPS)}
        </p>
      )}
    </Screen>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[70] bg-[var(--bg)] overflow-y-auto">
      <div className="mx-auto max-w-md min-h-[100dvh] flex flex-col px-6 pt-[max(28px,env(safe-area-inset-top))] pb-[max(20px,env(safe-area-inset-bottom))]">
        {children}
      </div>
    </div>
  );
}

function Step({
  emoji,
  title,
  sub,
  children,
}: {
  emoji: string;
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div>
        <div className="text-[40px] leading-none mb-3">{emoji}</div>
        <h2 className="text-[24px] font-extrabold tracking-tight leading-tight">{title}</h2>
        <p className="secondary text-[15px] mt-1.5 leading-7">{sub}</p>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
