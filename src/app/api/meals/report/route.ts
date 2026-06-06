import { authed, ok, bad } from "@/lib/api";
import { guardAI } from "@/lib/aiGuard";
import { aiText } from "@/lib/openrouter";

export const runtime = "nodejs";

type MealRow = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meal_type: string;
};

const TYPE_FA: Record<string, string> = {
  breakfast: "صبحانه",
  lunch: "ناهار",
  dinner: "شام",
  snack: "میان‌وعده",
};

export async function GET(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const guard = await guardAI(a.db, a.uid, "meal_report");
  if ("error" in guard) return guard.error;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");

  let mealsQuery = a.db
    .from("meals")
    .select("name, calories, protein, carbs, fat, meal_type")
    .eq("user_id", a.uid);
  if (date) mealsQuery = mealsQuery.eq("eaten_on", date);

  const [mealsRes, profileRes] = await Promise.all([
    mealsQuery,
    a.db.from("profiles").select("daily_calorie_goal").eq("user_id", a.uid).maybeSingle(),
  ]);

  if (mealsRes.error) return bad(mealsRes.error.message, 500);

  const meals = (mealsRes.data || []) as MealRow[];
  if (meals.length === 0) {
    return ok({
      report: "امروز هنوز وعده‌ای ثبت نکرده‌ای. وقتی چیزی خوردی اضافه کن تا برات تحلیلش کنم.",
      consumed: 0,
      goal: profileRes.data?.daily_calorie_goal || 2000,
    });
  }

  const goal = profileRes.data?.daily_calorie_goal || 2000;
  const consumed = meals.reduce((s, m) => s + (Number(m.calories) || 0), 0);
  const macro = meals.reduce(
    (acc, m) => ({
      p: acc.p + (Number(m.protein) || 0),
      c: acc.c + (Number(m.carbs) || 0),
      f: acc.f + (Number(m.fat) || 0),
    }),
    { p: 0, c: 0, f: 0 }
  );
  const lines = meals
    .map(
      (m) =>
        `- ${m.name} (${TYPE_FA[m.meal_type] || m.meal_type}): ${m.calories} کالری، پروتئین ${m.protein}گ، کربو ${m.carbs}گ، چربی ${m.fat}گ`
    )
    .join("\n");

  try {
    const report = await aiText(
      [
        {
          role: "system",
          content:
            "تو یک مربی تغذیه‌ی صمیمی و فارسی‌زبان هستی. بر اساس وعده‌های امروزِ کاربر یک گزارش کوتاه، مثبت و کاربردی بده. " +
            "ساختار: ۱) یک جمله جمع‌بندی کالری نسبت به هدف، ۲) تعادل درشت‌مغذی‌ها (پروتئین/کربو/چربی)، ۳) یک نکته‌ی خوب امروز، ۴) یک پیشنهاد ساده برای بهتر شدن. " +
            "کوتاه و خوانا بنویس، از ایموجی کم و مناسب استفاده کن و از Markdown سنگین پرهیز کن.",
        },
        {
          role: "user",
          content:
            `هدف کالری روزانه: ${goal}\n` +
            `کالری مصرف‌شده تا الان: ${consumed}\n` +
            `جمع درشت‌مغذی‌ها: پروتئین ${Math.round(macro.p)}گ، کربو ${Math.round(macro.c)}گ، چربی ${Math.round(macro.f)}گ\n\n` +
            `وعده‌های امروز:\n${lines}`,
        },
      ],
      { temperature: 0.5, maxTokens: 500 }
    );

    return ok({ report, consumed, goal });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "تهیه‌ی گزارش با خطا روبه‌رو شد.", 502);
  }
}
