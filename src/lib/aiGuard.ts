import { NextResponse } from "next/server";
import type { getServiceClient } from "@/lib/supabase";
import {
  ABUSE_PER_MIN,
  FREE_DAILY,
  HEAVY_DAILY,
  HEAVY_ENDPOINTS,
  costOf,
  isHeavy,
  getActiveSubscription,
} from "@/lib/billing";
import { isEnabled } from "@/lib/flags";

type DB = ReturnType<typeof getServiceClient>;

const PLAN_OK = -1; // اعتبار = -1 یعنی «از طریقِ اشتراک، بدونِ کسرِ اعتبار»

/**
 * سقفِ سختِ مصرفِ هوش مصنوعی برای کلِ اپ در ۲۴ ساعت (قطع‌کننده‌ی هزینه).
 * بدونِ این، یک سوءاستفاده (مثلاً ساختِ انبوهِ کاربرِ مهمان) می‌تواند صورتحسابِ
 * OpenRouter را بی‌نهایت بالا ببرد. با env قابلِ تنظیم؛ مقدارِ ۰ یا منفی = غیرفعال.
 */
function globalDailyCap(): number {
  const n = Number(process.env.AI_GLOBAL_DAILY_CAP);
  return Number.isFinite(n) ? n : 5000;
}

/**
 * نگهبانِ هوش مصنوعی: هر مسیرِ AI بلافاصله بعد از authed() این را صدا می‌زند.
 * ترتیب:
 *   (۱) سقفِ ضدِسوءاستفاده در دقیقه (محافظت).
 *   (۲) اشتراکِ فعال؟ → سرویسِ سبک نامحدود؛ سرویسِ سنگین تا سقفِ روزانه‌ی پلن.
 *   (۳) بدونِ اشتراک → سهمیه‌ی رایگانِ روزانه، سپس اعتبارِ کیفِ پول.
 * هر فراخوانیِ مجاز یک رویداد در ai_usage ثبت می‌کند.
 */
export async function guardAI(
  db: DB,
  uid: string,
  endpoint: string
): Promise<{ ok: true; credits: number } | { error: NextResponse }> {
  const now = Date.now();

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  // (−۱) کلیدِ قطعِ دستی/خودکار — فلگِ ai_enabled (و maintenance_mode).
  // پایشِ هزینه وقتی بودجه پر شود همین فلگ را می‌اندازد؛ ادمین هم می‌تواند دستی
  // قطع کند. کش‌شده است (~۳۰ث) تا روی هر فراخوانی یک کوئریِ اضافه نزند.
  if (!(await isEnabled(db, "ai_enabled"))) {
    return {
      error: NextResponse.json(
        { error: "هوش مصنوعیِ جوانه موقتاً غیرفعاله؛ کمی بعد دوباره امتحان کن. 🌱", code: "AI_DISABLED" },
        { status: 503 }
      ),
    };
  }

  // (۰) قطع‌کننده‌ی هزینه — سقفِ سختِ مصرفِ کلِ اپ در روز
  const cap = globalDailyCap();
  if (cap > 0) {
    const { count: globalToday } = await db
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfDay.toISOString());
    if ((globalToday ?? 0) >= cap) {
      return {
        error: NextResponse.json(
          { error: "جوانه الان خیلی شلوغه؛ کمی بعد دوباره امتحان کن. 🌱", code: "GLOBAL_LIMIT" },
          { status: 503 }
        ),
      };
    }
  }

  // (۱) محافظت — سقفِ سختِ دقیقه‌ای
  const minuteAgo = new Date(now - 60_000).toISOString();
  const { count: lastMinute } = await db
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", uid)
    .gte("created_at", minuteAgo);
  if ((lastMinute ?? 0) >= ABUSE_PER_MIN) {
    return {
      error: NextResponse.json(
        { error: "کمی آرام‌تر؛ چند لحظه‌ی دیگه دوباره امتحان کن.", code: "RATE_LIMITED" },
        { status: 429 }
      ),
    };
  }

  // (۲) اشتراکِ فعال
  const sub = await getActiveSubscription(db, uid);
  if (sub) {
    if (!isHeavy(endpoint)) {
      // سرویسِ سبک → نامحدود
      await db.from("ai_usage").insert({ user_id: uid, endpoint });
      return { ok: true, credits: PLAN_OK };
    }
    // سرویسِ سنگین → تا سقفِ روزانه‌ی پلن
    const { count: heavyToday } = await db
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .in("endpoint", HEAVY_ENDPOINTS)
      .gte("created_at", startOfDay.toISOString());
    const limit = HEAVY_DAILY[sub.plan] ?? 0;
    if ((heavyToday ?? 0) < limit) {
      await db.from("ai_usage").insert({ user_id: uid, endpoint });
      return { ok: true, credits: PLAN_OK };
    }
    return {
      error: NextResponse.json(
        {
          error: "سقفِ تحلیل‌های سنگینِ امروزِ پلنت پر شد. فردا دوباره، یا به پرو ارتقا بده.",
          code: "PLAN_LIMIT",
        },
        { status: 402 }
      ),
    };
  }

  // (۳) بدونِ اشتراک — سهمیه‌ی رایگانِ امروز، سپس اعتبار
  const { count: usedToday } = await db
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", uid)
    .gte("created_at", startOfDay.toISOString());

  let credits = 0;
  if ((usedToday ?? 0) >= FREE_DAILY) {
    const { data, error } = await db.rpc("spend_credit", {
      p_user: uid,
      p_cost: costOf(endpoint),
      p_reason: endpoint,
    });
    if (error) {
      return {
        error: NextResponse.json({ error: "خطا در بررسیِ اعتبار." }, { status: 500 }),
      };
    }
    credits = (data as number) ?? -1;
    if (credits < 0) {
      return {
        error: NextResponse.json(
          { error: "سهمیه‌ی امروزت تموم شد. برای ادامه پلاس بگیر یا کیف پولت رو شارژ کن.", code: "INSUFFICIENT_CREDITS" },
          { status: 402 }
        ),
      };
    }
  }

  await db.from("ai_usage").insert({ user_id: uid, endpoint });
  return { ok: true, credits };
}
