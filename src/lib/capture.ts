import { getServiceClient } from "@/lib/supabase";
import { aiJSON } from "@/lib/openrouter";
import { todayISO } from "@/lib/format";

type DB = ReturnType<typeof getServiceClient>;

export type ParsedItem = {
  type: "meal" | "expense" | "income" | "water" | "weight" | "sleep" | "steps";
  label?: string;
  // meal
  name?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  meal_type?: "breakfast" | "lunch" | "dinner" | "snack";
  // transaction
  amount?: number;
  category?: string;
  note?: string;
  // health metric
  value?: number;
};

export type ParseResult = { items: ParsedItem[]; note?: string };
export type SavedItem = { type: string; label: string };
export type CaptureResult = { saved: SavedItem[]; note?: string; errors: string[] };

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"];

/** کلیدواژه‌هایی که نشان می‌دهند کاربر داره چیزی رو گزارش/ثبت می‌کنه (خوردن، خرج، اندازه‌گیری). */
const INTAKE_HINTS = [
  "خوردم", "خوردیم", "خورده", "نوشیدم", "نوشیدیم",
  "صبحانه", "صبحونه", "ناهار", "نهار", "شام", "عصرونه", "میان‌وعده", "میان وعده", "اسنک", "خوراکی",
  "لیوان", "بطری", "قهوه", "چای", "کالری",
  "تومن", "تومان", "خریدم", "خرج کردم", "خرج",
  "وزنم", "خوابیدم", "ساعت خواب", "قدم زدم", "قدم",
];

/** آیا این پیام احتمالاً شاملِ چیزی برای ثبت است؟ (گیتِ سبک قبل از فراخوانیِ هوش مصنوعی) */
export function looksLikeIntake(text: string): boolean {
  const t = text.toLowerCase();
  return INTAKE_HINTS.some((k) => t.includes(k));
}

/**
 * متنِ زبانِ طبیعی را به آیتم‌های ساختاریافته تبدیل و ذخیره می‌کند.
 * هم در «ثبت سریع» و هم در چتِ مربی استفاده می‌شود.
 */
export async function captureFromText(db: DB, uid: string, raw: string): Promise<CaptureResult> {
  const text = String(raw || "").trim().slice(0, 600);
  if (!text) return { saved: [], note: "یه چیزی بنویس تا ثبتش کنم.", errors: [] };

  const today = todayISO();

  let parsed: ParseResult;
  try {
    parsed = await aiJSON<ParseResult>(
      [
        {
          role: "system",
          content:
            "تو یک دستیارِ ثبتِ سریع برای یک اپِ فارسیِ سبکِ‌زندگی هستی. کاربر با زبانِ طبیعی چیزی می‌نویسه؛ تو باید اون رو به آیتم‌های ساختاریافته تبدیل کنی تا ذخیره بشن. " +
            "خروجی فقط JSON با این شکل: {\"items\":[...]}. هر آیتم یک «type» داره از این مجموعه: meal, expense, income, water, weight, sleep, steps.\n" +
            "- meal: غذا/خوراکی. فیلدها: name (نامِ کوتاهِ فارسی)، calories (تخمینِ کالری بر اساس مقدارِ گفته‌شده، عددِ صحیح)، protein، carbs، fat (گرم، تخمینی)، meal_type (breakfast/lunch/dinner/snack — اگر مشخص نبود snack).\n" +
            "- expense: خرج/خرید. فیلدها: amount (به تومان، عددِ کامل بدون جداکننده؛ «۸۰ تومن»=80000، «۲ میلیون»=2000000)، category (دسته‌ی کوتاه مثل «غذا»، «حمل‌ونقل»، «خرید»)، note (اختیاری).\n" +
            "- income: درآمد. مثل expense ولی برای پولِ ورودی.\n" +
            "- water: آب. فیلد value به میلی‌لیتر («یه لیوان»=250، «دو لیوان»=500، «یه بطری»=500).\n" +
            "- weight: وزن. فیلد value به کیلوگرم.\n" +
            "- sleep: خواب. فیلد value به ساعت.\n" +
            "- steps: قدم. فیلد value تعدادِ قدم.\n" +
            "هر آیتم یک «label» فارسیِ کوتاه و خوانا هم داشته باشه که خلاصه‌ی همون آیتمه (مثلاً «نهار — حدود ۶۵۰ کالری» یا «خرج ۸۰٬۰۰۰ تومان بابت نهار»). " +
            "یک متن ممکنه چند آیتم داشته باشه. اگه هیچ چیزِ قابلِ‌ثبتی نبود items رو خالی برگردون و در «note» با مهربونی توضیح بده. اعداد همه به‌صورتِ انگلیسی (لاتین) و خام باشن. " +
            `تاریخِ امروز ${today} است؛ همه‌چیز برای امروز ثبت می‌شه.`,
        },
        { role: "user", content: text },
      ],
      { temperature: 0.2, maxTokens: 600 }
    );
  } catch (e) {
    return { saved: [], errors: [e instanceof Error ? e.message : "نتونستم متن رو بفهمم."] };
  }

  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  if (!items.length) {
    return { saved: [], note: parsed?.note, errors: [] };
  }

  const saved: SavedItem[] = [];
  const errors: string[] = [];

  for (const it of items) {
    try {
      if (it.type === "meal") {
        const name = String(it.name || "").trim();
        if (!name) continue;
        const { error } = await db.from("meals").insert({
          user_id: uid,
          name,
          calories: Math.max(0, Math.round(Number(it.calories) || 0)),
          protein: Math.max(0, Math.round(Number(it.protein) || 0)),
          carbs: Math.max(0, Math.round(Number(it.carbs) || 0)),
          fat: Math.max(0, Math.round(Number(it.fat) || 0)),
          meal_type: MEAL_TYPES.includes(it.meal_type as string) ? it.meal_type : "snack",
          eaten_on: today,
        });
        if (error) throw new Error(error.message);
        saved.push({ type: "meal", label: it.label || name });
      } else if (it.type === "expense" || it.type === "income") {
        const amount = Math.abs(Math.round(Number(it.amount) || 0));
        if (!amount) continue;
        const { error } = await db.from("transactions").insert({
          user_id: uid,
          kind: it.type,
          amount,
          category: String(it.category || (it.type === "income" ? "درآمد" : "سایر")),
          note: it.note ? String(it.note) : null,
          occurred_on: today,
        });
        if (error) throw new Error(error.message);
        saved.push({ type: it.type, label: it.label || `${it.category || ""}` });
      } else if (it.type === "water" || it.type === "weight" || it.type === "sleep" || it.type === "steps") {
        const value = Number(it.value);
        if (isNaN(value)) continue;
        const { error } = await db.from("health_metrics").insert({
          user_id: uid,
          kind: it.type,
          value,
          recorded_on: today,
        });
        if (error) throw new Error(error.message);
        saved.push({ type: it.type, label: it.label || `${it.type}` });
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "خطا در ذخیره یک آیتم");
    }
  }

  return { saved, note: parsed?.note, errors };
}
