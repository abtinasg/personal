import { NextResponse } from "next/server";
import type { getServiceClient } from "@/lib/supabase";
import { ABUSE_PER_MIN, FREE_DAILY, costOf } from "@/lib/billing";

type DB = ReturnType<typeof getServiceClient>;

/**
 * نگهبانِ هوش مصنوعی: هر مسیرِ AI بلافاصله بعد از authed() این را صدا می‌زند.
 * ترتیب: (۱) سقفِ ضدِسوءاستفاده در دقیقه، (۲) سهمیهٔ رایگانِ روزانه،
 * (۳) مصرفِ اعتبارِ کیفِ پول. هر فراخوانیِ مجاز یک رویداد در ai_usage ثبت می‌کند.
 */
export async function guardAI(
  db: DB,
  uid: string,
  endpoint: string
): Promise<{ ok: true; credits: number } | { error: NextResponse }> {
  const now = Date.now();

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

  // (۲) پی‌وال — سهمیهٔ رایگانِ امروز
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { count: usedToday } = await db
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", uid)
    .gte("created_at", startOfDay.toISOString());

  let credits = 0;
  if ((usedToday ?? 0) >= FREE_DAILY) {
    // (۳) فراتر از سهمیهٔ رایگان → مصرفِ اعتبار به‌صورتِ اتمیک
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
          { error: "اعتبارت تموم شد. برای ادامه کیف پولت رو شارژ کن.", code: "INSUFFICIENT_CREDITS" },
          { status: 402 }
        ),
      };
    }
  }

  // ثبتِ رویدادِ مصرف (هم برای سهمیهٔ رایگان، هم پولی)
  await db.from("ai_usage").insert({ user_id: uid, endpoint });

  return { ok: true, credits };
}
