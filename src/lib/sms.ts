import crypto from "crypto";

/**
 * شمارهٔ موبایل ایران را به فرمتِ استانداردِ ۰۹xxxxxxxxx نرمال می‌کند.
 * ورودی‌های پذیرفته‌شده: 09xxxxxxxxx، 9xxxxxxxxx، +989xxxxxxxxx، 00989xxxxxxxxx
 * در صورت نامعتبر بودن null برمی‌گرداند.
 */
export function normalizePhone(input: string): string | null {
  const latin = String(input || "")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  let digits = latin.replace(/\D/g, "");

  if (digits.startsWith("0098")) digits = digits.slice(4);
  else if (digits.startsWith("98")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = digits.slice(1);

  if (!/^9\d{9}$/.test(digits)) return null;
  return "0" + digits;
}

/** تبدیل فرمت ایرانی (09xx) به فرمت بین‌المللی (989xx) برای SMS.ir */
function toInternational(phone: string): string {
  return "98" + phone.slice(1);
}

/** کدِ عددیِ تصادفیِ n رقمی (پیش‌فرض ۵ رقم). */
export function generateOtp(length = 5): string {
  const max = 10 ** length;
  const n = crypto.randomInt(0, max);
  return n.toString().padStart(length, "0");
}

/** هشِ کد برای ذخیرهٔ امن (کد خام هرگز در دیتابیس نمی‌ماند). */
export function hashOtp(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

/**
 * ارسال کد یک‌بارمصرف با SMS.ir (likeToLike — بدون نیاز به template).
 * نیازمند SMSIR_API_KEY و SMSIR_LINE در محیط است.
 */
export async function sendOtpSms(phone: string, code: string): Promise<void> {
  const key = process.env.SMSIR_API_KEY;
  const line = process.env.SMSIR_LINE;

  if (!key || !line) {
    throw new Error(
      "سرویس پیامک تنظیم نشده است. SMSIR_API_KEY و SMSIR_LINE را در .env قرار بده."
    );
  }

  let res: Response;
  try {
    res = await fetch("https://api.sms.ir/v1/send/likeToLike", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-API-Key": key,
      },
      body: JSON.stringify({
        lineNumber: line,
        sendDateTime: null,
        mobiles: [toInternational(phone)],
        messageTexts: [`کد تأیید شما: ${code}`],
      }),
    });
  } catch {
    throw new Error("ارتباط با سرویس پیامک برقرار نشد.");
  }

  const body = await res.json().catch(() => null as any);
  if (!res.ok || body?.status !== 1) {
    const msg = body?.message || `کد وضعیت ${res.status}`;
    throw new Error(`ارسال پیامک ناموفق بود: ${msg}`);
  }
}
