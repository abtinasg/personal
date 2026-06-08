import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { normalizePhone, generateOtp, hashOtp, sendOtpSms } from "@/lib/sms";
import { logEvent } from "@/lib/events";
import { isEnabled } from "@/lib/flags";

export const runtime = "nodejs";

const RESEND_COOLDOWN_MS = 60 * 1000; // حداقل فاصلهٔ ارسال مجدد: ۶۰ ثانیه
const CODE_TTL_MS = 2 * 60 * 1000; // اعتبار کد: ۲ دقیقه

// خط پیامکیِ فعلی تبلیغاتی است و کاریِر شب اجازهٔ ارسال نمی‌دهد، پس به‌صورتِ پیش‌فرض
// ارسال فقط ۸ صبح تا ۱۰ شب مجاز است. این بازه از env قابلِ تنظیم است تا به‌محضِ
// گرفتنِ خطِ خدماتی/تراکنشی (که شبانه‌روزی مجاز است) بدونِ دیپلویِ مجدد به ۰ تا ۲۴
// باز شود — همان ریشهٔ اصلیِ قفلِ ثبت‌نامِ شبانه.
const OTP_OPEN_HOUR = clampHour(process.env.OTP_OPEN_HOUR, 8); // شروع بازهٔ مجاز (شامل)
const OTP_CLOSE_HOUR = clampHour(process.env.OTP_CLOSE_HOUR, 22); // پایان بازهٔ مجاز (غیرشامل)

/** مقدارِ ساعتِ env را به عددِ ۰..۲۴ تبدیل می‌کند؛ نامعتبر → پیش‌فرض. */
function clampHour(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 24 ? n : fallback;
}

/** آیا ساعت فعلی به وقت تهران در بازهٔ مجاز ارسال کد است؟ */
function isWithinOtpWindow(): boolean {
  // بازهٔ کامل (۰..۲۴) یعنی محدودیتی نیست — برای خطِ تراکنشیِ شبانه‌روزی.
  if (OTP_OPEN_HOUR <= 0 && OTP_CLOSE_HOUR >= 24) return true;
  const hourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tehran",
    hour: "2-digit",
    hour12: false,
  }).format(new Date());
  // "24" را برای نیمه‌شب به ۰ نگاشت می‌کنیم.
  const hour = Number(hourStr) % 24;
  return hour >= OTP_OPEN_HOUR && hour < OTP_CLOSE_HOUR;
}

export async function POST(req: Request) {
  const { phone } = await req.json().catch(() => ({}));
  const rawPhone = String(phone || "").trim();

  // اکانت تست — قبل از validation، بدون ارسال پیامک.
  // فقط خارج از پروداکشن فعال است تا یک کدِ ثابت هرگز به‌عنوانِ درِ پشتیِ ورود در پروداکشن لو نرود.
  const testPhone = process.env.TEST_PHONE;
  if (process.env.NODE_ENV !== "production" && testPhone && rawPhone === testPhone) {
    return NextResponse.json({ ok: true, ttl: CODE_TTL_MS / 1000 });
  }

  const normalized = normalizePhone(rawPhone);

  if (!normalized) {
    return NextResponse.json(
      { error: "شمارهٔ موبایل معتبر نیست." },
      { status: 400 }
    );
  }

  const db = getServiceClient();

  // کلیدِ قطعِ ثبت‌نام (و maintenance_mode)
  if (!(await isEnabled(db, "signups_enabled"))) {
    return NextResponse.json(
      { error: "ثبت‌نام موقتاً بسته است. کمی بعد دوباره سر بزن. 🌱", code: "SIGNUPS_DISABLED" },
      { status: 503 }
    );
  }

  // گیت زمانی — خارج از بازهٔ مجاز، کد ارسال نمی‌شود.
  if (!isWithinOtpWindow()) {
    // ثبتِ این رد، تا داشبوردِ عملیات «چند ثبت‌نامِ شبانه را به‌خاطرِ خطِ تبلیغاتی
    // از دست می‌دهیم» را کمّی کند — توجیهِ خریدِ خطِ تراکنشی.
    await logEvent(db, "otp_closed", { props: { phone: normalized } });
    return NextResponse.json(
      {
        error: "دریافت کد فقط از ۸ صبح تا ۱۰ شب ممکن است. اگر رمز داری با رمز وارد شو، وگرنه صبح برگرد.",
        code: "otp_closed",
      },
      { status: 403 }
    );
  }

  // ضدِاسپم + ذخیرهٔ کد — هر دو در یک query
  const { data: existing } = await db
    .from("phone_otps")
    .select("last_sent_at")
    .eq("phone", normalized)
    .maybeSingle();

  if (existing?.last_sent_at) {
    const elapsed = Date.now() - new Date(existing.last_sent_at).getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
      return NextResponse.json(
        { error: `کمی صبر کن، تا ${wait} ثانیهٔ دیگر می‌توانی دوباره کد بگیری.` },
        { status: 429 }
      );
    }
  }

  const code = generateOtp(5);
  const now = new Date();

  const { error: upErr } = await db.from("phone_otps").upsert({
    phone: normalized,
    code_hash: hashOtp(code),
    expires_at: new Date(now.getTime() + CODE_TTL_MS).toISOString(),
    attempts: 0,
    last_sent_at: now.toISOString(),
  }, { onConflict: "phone" });

  if (upErr) {
    return NextResponse.json(
      { error: "خطا در ثبت کد. دوباره تلاش کن." },
      { status: 500 }
    );
  }

  try {
    await sendOtpSms(normalized, code);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "ارسال پیامک ناموفق بود." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, ttl: CODE_TTL_MS / 1000 });
}
