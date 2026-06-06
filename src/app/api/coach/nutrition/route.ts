import { authed, ok, bad } from "@/lib/api";
import { guardAI } from "@/lib/aiGuard";
import { aiJSON } from "@/lib/openrouter";
import { daysAgoISO } from "@/lib/format";

export const runtime = "nodejs";

const ACTIVITY_FACTOR: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const TYPE_FA: Record<string, string> = {
  breakfast: "صبحانه",
  lunch: "ناهار",
  dinner: "شام",
  snack: "میان‌وعده",
};

function bmiLabel(bmi: number): string {
  if (bmi < 18.5) return "کمبود وزن";
  if (bmi < 25) return "نرمال";
  if (bmi < 30) return "اضافه‌وزن";
  return "چاقی";
}

type NutritionPlan = {
  recommended_calories: number;
  target_weight: number | null;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  summary: string;
  patterns: string;
  tips: string[];
};

export async function GET() {
  const a = await authed();
  if ("error" in a) return a.error;
  const guard = await guardAI(a.db, a.uid, "coach_nutrition");
  if ("error" in guard) return guard.error;

  const thisYear = new Date().getFullYear();

  const [{ data: profile }, weightRes, missionRes, mealsRes] = await Promise.all([
    a.db.from("profiles").select("*").eq("user_id", a.uid).maybeSingle(),
    a.db.from("health_metrics").select("value, recorded_on").eq("user_id", a.uid).eq("kind", "weight").order("recorded_on", { ascending: false }).limit(1),
    a.db.from("missions").select("title, target_label, target_value, target_unit").eq("user_id", a.uid).eq("status", "active").order("created_at", { ascending: false }).limit(1),
    a.db.from("meals").select("calories, protein, carbs, fat, meal_type, eaten_on").eq("user_id", a.uid).gte("eaten_on", daysAgoISO(6)),
  ]);

  const latestWeight = weightRes.data?.[0]?.value != null ? Number(weightRes.data[0].value) : null;

  // فیلدهای لازم را بررسی کن
  const needs: string[] = [];
  if (latestWeight == null) needs.push("weight");
  if (!profile?.height_cm) needs.push("height_cm");
  if (!profile?.sex) needs.push("sex");
  if (!profile?.birth_year) needs.push("birth_year");
  if (needs.length) return ok({ needs });

  const h = Number(profile!.height_cm);
  const w = latestWeight!;
  const age = Math.max(10, thisYear - Number(profile!.birth_year));
  const sex = profile!.sex as "male" | "female";
  const activity = (profile!.activity_level as string) || "light";

  const bmi = w / Math.pow(h / 100, 2);
  const bmr = 10 * w + 6.25 * h - 5 * age + (sex === "male" ? 5 : -161);
  const tdee = bmr * (ACTIVITY_FACTOR[activity] || 1.375);

  const mission = missionRes.data?.[0] || null;

  // تجمیع خوراک ۷ روز اخیر بر اساس نوع وعده
  const meals = mealsRes.data || [];
  const dayCount = Math.max(1, new Set(meals.map((m) => m.eaten_on)).size);
  const byType = new Map<string, { cal: number; p: number; c: number; f: number; n: number }>();
  for (const m of meals) {
    const k = m.meal_type || "snack";
    const cur = byType.get(k) || { cal: 0, p: 0, c: 0, f: 0, n: 0 };
    cur.cal += Number(m.calories) || 0;
    cur.p += Number(m.protein) || 0;
    cur.c += Number(m.carbs) || 0;
    cur.f += Number(m.fat) || 0;
    cur.n += 1;
    byType.set(k, cur);
  }
  const mealSummary = [...byType.entries()]
    .map(([t, v]) => `${TYPE_FA[t] || t}: میانگین روزانه ${Math.round(v.cal / dayCount)} کالری (پروتئین ${Math.round(v.p / dayCount)}گ، کربو ${Math.round(v.c / dayCount)}گ، چربی ${Math.round(v.f / dayCount)}گ)`)
    .join("؛ ") || "هنوز وعده‌ای ثبت نشده";
  const avgDailyCal = Math.round(meals.reduce((s, m) => s + (Number(m.calories) || 0), 0) / dayCount);

  const metrics = {
    bmi: Math.round(bmi * 10) / 10,
    bmi_label: bmiLabel(bmi),
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    age,
    weight: w,
    height: h,
    avg_daily_calories: avgDailyCal,
  };

  try {
    const plan = await aiJSON<NutritionPlan>(
      [
        {
          role: "system",
          content:
            "تو یک متخصص تغذیه‌ی فارسی‌زبان، دقیق و واقع‌بین هستی. " +
            "بر اساس اعدادِ محاسبه‌شده (BMR/TDEE/BMI) و هدفِ ماموریتِ کاربر، یک برنامه‌ی کالری و درشت‌مغذی امن و علمی بده. " +
            "کسری/مازاد کالری باید معقول باشد (حداکثر حدود ۲۰٪ از TDEE) و کالری توصیه‌شده هیچ‌وقت زیر BMR نباشد. " +
            "اگر هدف کاهش وزن است کسری ملایم، اگر افزایش وزن است مازاد ملایم، وگرنه حفظِ وزن. " +
            "پروتئین را کافی (حدود ۱.۶ تا ۲.۲ گرم به ازای هر کیلو وزن) در نظر بگیر. " +
            "در بخش patterns بر اساس میانگین وعده‌ها بگو کاربر کجا (کدام وعده) زیادی می‌خورد و چه چیزی (مثلاً پروتئین) کم می‌خورد؛ صمیمی و کوتاه. " +
            "فقط یک JSON معتبر برگردان: " +
            '{"recommended_calories":number,"target_weight":number|null,"protein_g":number,"carb_g":number,"fat_g":number,"summary":string,"patterns":string,"tips":string[]}. ' +
            "summary یک‌دو جمله. tips بین ۲ تا ۴ مورد کوتاه و عملی.",
        },
        {
          role: "user",
          content:
            `جنسیت: ${sex === "male" ? "مرد" : "زن"}\n` +
            `سن: ${age} سال، قد: ${h} سانتی‌متر، وزن فعلی: ${w} کیلوگرم\n` +
            `BMI: ${metrics.bmi} (${metrics.bmi_label})\n` +
            `BMR: ${metrics.bmr} کالری، TDEE (با فعالیت ${activity}): ${metrics.tdee} کالری\n` +
            (profile!.weight_goal != null ? `وزن هدفِ ثبت‌شده: ${profile!.weight_goal} کیلوگرم\n` : "") +
            (mission
              ? `ماموریت فعال: «${mission.title}»` +
                (mission.target_label ? ` — هدف: ${mission.target_label} ${mission.target_value ?? ""} ${mission.target_unit ?? ""}` : "") +
                "\n"
              : "ماموریت فعالِ مرتبط با وزن ندارد.\n") +
            `میانگین کالری مصرفی روزانه (۷ روز اخیر): ${avgDailyCal}\n` +
            `الگوی وعده‌ها: ${mealSummary}`,
        },
      ],
      { temperature: 0.4, maxTokens: 700 }
    );

    // محدودسازی امن
    const safe: NutritionPlan = {
      recommended_calories: Math.max(metrics.bmr, Math.round(Number(plan.recommended_calories) || metrics.tdee)),
      target_weight: plan.target_weight != null && !isNaN(Number(plan.target_weight)) ? Number(plan.target_weight) : (profile!.weight_goal ?? null),
      protein_g: Math.max(0, Math.round(Number(plan.protein_g) || 0)),
      carb_g: Math.max(0, Math.round(Number(plan.carb_g) || 0)),
      fat_g: Math.max(0, Math.round(Number(plan.fat_g) || 0)),
      summary: String(plan.summary || "").slice(0, 400),
      patterns: String(plan.patterns || "").slice(0, 400),
      tips: (Array.isArray(plan.tips) ? plan.tips : []).map((t) => String(t).slice(0, 120)).filter(Boolean).slice(0, 4),
    };

    return ok({ metrics, plan: safe });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "تهیه‌ی برنامه با خطا روبه‌رو شد.", 502);
  }
}
