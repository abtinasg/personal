import type { getServiceClient } from "@/lib/supabase";

type DB = ReturnType<typeof getServiceClient>;

/** نام‌های استانداردِ رویداد — قیفِ محصول و سیگنال‌های عملیاتی. */
export type EventName =
  | "guest_start" // ورودِ مهمان ساخته شد
  | "signup" // ثبت‌نام با شماره (تأییدِ OTP) کامل شد
  | "checkout_start" // کاربر به درگاهِ پرداخت رفت
  | "payment_paid" // پرداخت نهایی و اشتراک/اعتبار فعال شد
  | "otp_closed" // درخواستِ کد خارج از پنجره‌ی مجاز رد شد (سیگنالِ ازدست‌رفتنِ ثبت‌نامِ شبانه)
  | "ai_error"; // یک فراخوانیِ هوش مصنوعی خطا داد

/**
 * یک رویداد را ثبت می‌کند. عمداً «بی‌صدا» است: ثبتِ آنالیتیکس هرگز نباید مسیرِ
 * اصلیِ کاربر را بترکاند، پس هر خطا بلعیده می‌شود. props به‌صورتِ JSON ذخیره
 * می‌شود (ستونِ jsonb؛ Postgres رشته‌ی JSONِ معتبر را خودش cast می‌کند).
 */
export async function logEvent(
  db: DB,
  name: EventName,
  opts: { userId?: string | null; props?: Record<string, unknown>; ip?: string | null } = {}
): Promise<void> {
  try {
    await db.from("events").insert({
      name,
      user_id: opts.userId ?? null,
      props: opts.props ? JSON.stringify(opts.props) : undefined,
      ip: opts.ip ?? undefined,
    });
  } catch {
    // آنالیتیکس نباید جریانِ اصلی را متوقف کند.
  }
}
