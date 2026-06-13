import { authed, ok, bad } from "@/lib/api";
import { guardAI } from "@/lib/aiGuard";
import { aiJSON } from "@/lib/openrouter";
import { getCached, setCached, descKey } from "@/lib/aiCache";

export const runtime = "nodejs";

type Estimate = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
};

const TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;

export async function POST(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const b = await req.json().catch(() => ({}));
  const desc = String(b.description || b.name || "").trim();
  if (!desc) return bad("اول بنویس چی خوردی.");

  const cacheKey = `meal_est:${descKey(desc)}`;
  const cachedEst = await getCached<Estimate>(a.db, cacheKey);
  if (cachedEst) {
    const meal_type = TYPES.includes(cachedEst.meal_type) ? cachedEst.meal_type : "snack";
    return ok({ estimate: { ...cachedEst, meal_type } });
  }

  const guard = await guardAI(a.db, a.uid, "meal_estimate");
  if ("error" in guard) return guard.error;

  try {
    const est = await aiJSON<Estimate>([
      {
        role: "system",
        content:
          "تو یک متخصص تغذیه هستی که کالری و درشت‌مغذی‌های غذاهای ایرانی و بین‌المللی را تخمین می‌زنی. " +
          "بر اساس توضیح کاربر، مجموع کالری و گرم پروتئین، کربوهیدرات و چربی آن وعده را تخمین بزن. " +
          "اگر مقدار/تعداد مشخص نشده، یک پرس معمولی را فرض کن. اعداد باید واقع‌بینانه و صحیح (integer) باشند. " +
          "نوع وعده را از روی توضیح حدس بزن (در صورت نامشخص snack). " +
          'فقط و فقط یک JSON با این کلیدها برگردان: ' +
          '{"name": string, "calories": number, "protein": number, "carbs": number, "fat": number, "meal_type": "breakfast"|"lunch"|"dinner"|"snack"}. ' +
          "name باید یک نام کوتاه و تمیز فارسی برای غذا باشد.",
      },
      { role: "user", content: desc },
    ], { temperature: 0, seed: 1, maxTokens: 120, tag: "meal_estimate" });

    const meal_type = TYPES.includes(est.meal_type) ? est.meal_type : "snack";
    const estimate = {
      name: String(est.name || desc).trim().slice(0, 80),
      calories: Math.max(0, Math.round(Number(est.calories) || 0)),
      protein: Math.max(0, Math.round(Number(est.protein) || 0)),
      carbs: Math.max(0, Math.round(Number(est.carbs) || 0)),
      fat: Math.max(0, Math.round(Number(est.fat) || 0)),
      meal_type,
    };
    await setCached(a.db, cacheKey, estimate, 30 * 24 * 3600);
    return ok({
      estimate,
    });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "تخمین کالری با خطا روبه‌رو شد.", 502);
  }
}
