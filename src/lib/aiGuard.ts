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
import { getCachedSub, setCachedSub } from "@/lib/subCache";

type DB = ReturnType<typeof getServiceClient>;

const PLAN_OK = -1; // اعتبار = -1 یعنی «از طریقِ اشتراک، بدونِ کسرِ اعتبار»

/** سقفِ سختِ مصرفِ کلِ اپ در ۲۴ ساعت (قطع‌کننده‌ی هزینه). ۰ یا منفی = خاموش. */
function globalDailyCap(): number {
  const n = Number(process.env.AI_GLOBAL_DAILY_CAP);
  return Number.isFinite(n) ? n : 5000;
}

type UsageCounts = {
  globalToday: number;
  lastMinute: number;
  usedToday: number;
  heavyToday: number;
};

/**
 * همه‌ی شمارش‌های موردنیازِ نگهبان در «یک» رفت‌وبرگشتِ دیتابیس.
 *
 * نسخه‌ی قبلی ۳-۴ کوئریِ COUNTِ سریال می‌زد (سقفِ کلی، ضدِسوءاستفاده‌ی دقیقه‌ای،
 * سهمیه‌ی رایگان، سهمیه‌ی سنگین) — یعنی روی هر فراخوانیِ AI ده‌ها میلی‌ثانیه و
 * زیرِ بار صدها میلی‌ثانیه فقط صرفِ صف‌گرفتنِ pool می‌شد (forensics §3 رتبه‌ی ۴).
 * COUNT(*) FILTER همه را یک‌جا می‌گیرد.
 */
async function usageCounts(
  db: DB,
  uid: string,
  startOfDayISO: string,
  minuteAgoISO: string
): Promise<UsageCounts> {
  const rows = await db.query<Record<string, unknown>>(
    `select
       count(*) filter (where created_at >= $1::timestamptz)                                                  as global_today,
       count(*) filter (where user_id = $2 and created_at >= $3::timestamptz)                                 as last_minute,
       count(*) filter (where user_id = $2 and created_at >= $1::timestamptz)                                 as used_today,
       count(*) filter (where user_id = $2 and endpoint = any($4::text[]) and created_at >= $1::timestamptz)  as heavy_today
     from public.ai_usage
     where created_at >= least($1::timestamptz, $3::timestamptz)`,
    [startOfDayISO, uid, minuteAgoISO, HEAVY_ENDPOINTS]
  );
  const r = rows[0] ?? {};
  const n = (v: unknown) => Number(v ?? 0) || 0;
  return {
    globalToday: n(r.global_today),
    lastMinute: n(r.last_minute),
    usedToday: n(r.used_today),
    heavyToday: n(r.heavy_today),
  };
}

/** اشتراکِ فعال با کشِ ~۳۰ثانیه‌ای به‌ازای هر کاربر (subCache). */
async function subOf(db: DB, uid: string) {
  const hit = getCachedSub(uid);
  if (hit) return hit.sub;
  const sub = await getActiveSubscription(db, uid);
  setCachedSub(uid, sub);
  return sub;
}

/**
 * نگهبانِ هوش مصنوعی: هر مسیرِ AI بلافاصله بعد از authed() این را صدا می‌زند.
 *
 * تفاوت با نسخه‌ی قبل (نتیجه یکی است، فقط سریع‌تر):
 *   • فلگِ ai_enabled (کش‌شده)، اشتراک (کش‌شده) و همه‌ی شمارش‌ها «موازی» گرفته
 *     می‌شوند — به‌جای ۴-۶ await پشتِ‌سرِهم، عملاً یک RTT دیتابیس.
 *   • ثبتِ ai_usage از مسیرِ بحرانی خارج شد (fire-and-forget) — INSERT جلوی
 *     اولین token نمی‌نشیند. spend_credit همچنان await می‌شود چون تصمیمِ مالی است.
 */
export async function guardAI(
  db: DB,
  uid: string,
  endpoint: string
): Promise<{ ok: true; credits: number } | { error: NextResponse }> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const minuteAgoISO = new Date(Date.now() - 60_000).toISOString();

  const [aiOn, sub, usage] = await Promise.all([
    isEnabled(db, "ai_enabled"),
    subOf(db, uid),
    usageCounts(db, uid, startOfDay.toISOString(), minuteAgoISO),
  ]);

  // (−۱) کلیدِ قطعِ دستی/خودکار
  if (!aiOn) {
    return {
      error: NextResponse.json(
        { error: "هوش مصنوعیِ جوانه موقتاً غیرفعاله؛ کمی بعد دوباره امتحان کن. 🌱", code: "AI_DISABLED" },
        { status: 503 }
      ),
    };
  }

  // (۰) قطع‌کننده‌ی هزینه — سقفِ سختِ کلِ اپ در روز
  const cap = globalDailyCap();
  if (cap > 0 && usage.globalToday >= cap) {
    return {
      error: NextResponse.json(
        { error: "جوانه الان خیلی شلوغه؛ کمی بعد دوباره امتحان کن. 🌱", code: "GLOBAL_LIMIT" },
        { status: 503 }
      ),
    };
  }

  // (۱) محافظت — سقفِ سختِ دقیقه‌ای
  if (usage.lastMinute >= ABUSE_PER_MIN) {
    return {
      error: NextResponse.json(
        { error: "کمی آرام‌تر؛ چند لحظه‌ی دیگه دوباره امتحان کن.", code: "RATE_LIMITED" },
        { status: 429 }
      ),
    };
  }

  // ثبتِ مصرف — بیرون از مسیرِ بحرانی. شکستش نباید جریان را بترکاند؛ تنها اثرِ
  // جانبی این است که شمارنده‌ی ضدِسوءاستفاده چند میلی‌ثانیه دیرتر آپدیت می‌شود.
  const logUsage = () => {
    void db.from("ai_usage").insert({ user_id: uid, endpoint }).then(() => {});
  };

  // (۲) اشتراکِ فعال
  if (sub) {
    if (!isHeavy(endpoint)) {
      logUsage();
      return { ok: true, credits: PLAN_OK };
    }
    const limit = HEAVY_DAILY[sub.plan] ?? 0;
    if (usage.heavyToday < limit) {
      logUsage();
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
  let credits = 0;
  if (usage.usedToday >= FREE_DAILY) {
    const { data, error } = await db.rpc("spend_credit", {
      p_user: uid,
      p_cost: costOf(endpoint),
      p_reason: endpoint,
    });
    if (error) {
      return { error: NextResponse.json({ error: "خطا در بررسیِ اعتبار." }, { status: 500 }) };
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

  logUsage();
  return { ok: true, credits };
}
