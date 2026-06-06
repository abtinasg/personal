import crypto from "crypto";

/**
 * شمارهٔ موبایل ایران را به فرمتِ استانداردِ ۰۹xxxxxxxxx نرمال می‌کند.
 * ورودی‌های پذیرفته‌شده: 09xxxxxxxxx، 9xxxxxxxxx، +989xxxxxxxxx، 00989xxxxxxxxx
 * در صورت نامعتبر بودن null برمی‌گرداند.
 */
export function normalizePhone(input: string): string | null {
  // ارقام فارسی/عربی را به لاتین تبدیل کن، بعد فقط رقم‌ها را نگه دار.
  const latin = String(input || "")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  let digits = latin.replace(/\D/g, "");

  if (digits.startsWith("0098")) digits = digits.slice(4);
  else if (digits.startsWith("98")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = digits.slice(1);

  // الان باید 9xxxxxxxxx باشد (۱۰ رقم، شروع با 9)
  if (!/^9\d{9}$/.test(digits)) return null;
  return "0" + digits;
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
 * ارسال کد یک‌بارمصرف با سرویس send کاوه‌نگار (بدون نیاز به الگو).
 * نیازمند فقط KAVENEGAR_API_KEY در محیط است.
 */
export async function sendOtpSms(phone: string, code: string): Promise<void> {
  const key = process.env.KAVENEGAR_API_KEY;
  if (!key) {
    throw new Error(
      "سرویس پیامک تنظیم نشده است. KAVENEGAR_API_KEY را در .env قرار بده."
    );
  }

  const message = `کد تأیید شما: ${code}`;
  const url = new URL(`https://api.kavenegar.com/v1/${key}/sms/send.json`);
  url.searchParams.set("receptor", phone);
  url.searchParams.set("message", message);

  let res: Response;
  try {
    res = await fetch(url, { method: "GET" });
  } catch {
    throw new Error("ارتباط با سرویس پیامک برقرار نشد.");
  }

  const body = await res.json().catch(() => null as any);
  const result = body?.result;
  // کاوه‌نگار اگر موفق بود، result.status=1 یا entries[0].status=1
  const isSuccess = result?.status === 1 || body?.result?.[0]?.status === 1;
  if (!res.ok || !isSuccess) {
    const msg = body?.return?.message || `کد وضعیت ${res.status}`;
    throw new Error(`ارسال پیامک ناموفق بود: ${msg}`);
  }
}
