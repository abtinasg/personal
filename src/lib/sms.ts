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
 * ارسال کد یک‌بارمصرف با SMS.ir.
 *
 * دو حالت دارد:
 *  ۱) اگر SMSIR_TEMPLATE_ID ست شده باشد → سرویسِ اعتبارسنجی (verify).
 *     این روش روی خطِ سرویسِ تأییدشده می‌رود و توسط اپراتورها فیلتر نمی‌شود
 *     (روشِ توصیه‌شده برای OTP).
 *  ۲) در غیر این صورت → likeToLike روی SMSIR_LINE (خطِ معمولی/تبلیغاتی؛
 *     ممکن است به‌دستِ همهٔ کاربران نرسد).
 */
export async function sendOtpSms(phone: string, code: string): Promise<void> {
  const key = process.env.SMSIR_API_KEY;
  if (!key) {
    throw new Error(
      "سرویس پیامک تنظیم نشده است. SMSIR_API_KEY را در .env قرار بده."
    );
  }

  const templateId = process.env.SMSIR_TEMPLATE_ID;
  if (templateId) {
    await sendViaVerify(key, templateId, phone, code);
  } else {
    await sendViaLikeToLike(key, phone, code);
  }
}

/** سرویسِ اعتبارسنجیِ SMS.ir — قابل‌اعتماد برای OTP (خطِ سرویس). */
async function sendViaVerify(
  key: string,
  templateId: string,
  phone: string,
  code: string
): Promise<void> {
  // نامِ پارامتر باید با تعریفِ قالب در پنل بخواند؛ پیش‌فرض Code.
  const paramName = process.env.SMSIR_TEMPLATE_PARAM || "Code";

  let res: Response;
  try {
    res = await fetch("https://api.sms.ir/v1/send/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-API-Key": key,
      },
      body: JSON.stringify({
        mobile: phone, // فرمتِ 09xxxxxxxxx
        templateId: Number(templateId),
        parameters: [{ name: paramName, value: code }],
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

/** ارسالِ عادی روی خطِ معمولی (بدون قالب). */
async function sendViaLikeToLike(
  key: string,
  phone: string,
  code: string
): Promise<void> {
  const line = process.env.SMSIR_LINE;
  if (!line) {
    throw new Error(
      "سرویس پیامک تنظیم نشده است. SMSIR_LINE یا SMSIR_TEMPLATE_ID را در .env قرار بده."
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
