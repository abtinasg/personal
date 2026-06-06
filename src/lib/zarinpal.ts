/**
 * رپرِ سادهٔ درگاهِ زرین‌پال (REST API نسخهٔ ۴).
 * مبالغ به *تومان* گرفته می‌شوند و هنگامِ ارسال به ریال تبدیل می‌شوند
 * (زرین‌پال مبلغ را به ریال می‌خواهد). برای تستِ بدونِ پول از سندباکس
 * استفاده کن: ZARINPAL_SANDBOX=1.
 */

const SANDBOX = process.env.ZARINPAL_SANDBOX === "1";
const BASE = SANDBOX ? "https://sandbox.zarinpal.com" : "https://payment.zarinpal.com";

function merchantId(): string {
  const id = process.env.ZARINPAL_MERCHANT_ID;
  if (!id) {
    throw new Error(
      "مرچنت‌آیدیِ زرین‌پال تنظیم نشده. ZARINPAL_MERCHANT_ID را در .env قرار بده."
    );
  }
  return id;
}

/** صفحهٔ پرداختی که کاربر به آن ریدایرکت می‌شود. */
export function startPayUrl(authority: string): string {
  return `${BASE}/pg/StartPay/${authority}`;
}

/**
 * درخواستِ پرداخت. مبلغ به تومان. در صورتِ موفقیت Authority و آدرسِ پرداخت برمی‌گرداند.
 */
export async function requestPayment(opts: {
  amount: number; // تومان
  description: string;
  callbackUrl: string;
  mobile?: string;
}): Promise<{ authority: string; payUrl: string }> {
  const res = await fetch(`${BASE}/pg/v4/payment/request.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      merchant_id: merchantId(),
      amount: opts.amount * 10, // تومان → ریال
      description: opts.description,
      callback_url: opts.callbackUrl,
      ...(opts.mobile ? { metadata: { mobile: opts.mobile } } : {}),
    }),
  });
  const json = await res.json().catch(() => null);
  const authority = json?.data?.authority as string | undefined;
  if (!res.ok || !authority) {
    const code = json?.errors?.code ?? json?.data?.code ?? res.status;
    throw new Error(`خطا از زرین‌پال هنگامِ ساختِ پرداخت (${code}).`);
  }
  return { authority, payUrl: startPayUrl(authority) };
}

/**
 * تاییدِ پرداخت بعد از بازگشتِ کاربر. مبلغ باید همان مبلغِ درخواست (تومان) باشد.
 * code=100 یعنی موفق، code=101 یعنی قبلاً تایید شده.
 */
export async function verifyPayment(opts: {
  authority: string;
  amount: number; // تومان
}): Promise<{ ok: boolean; refId: string | null; alreadyVerified: boolean }> {
  const res = await fetch(`${BASE}/pg/v4/payment/verify.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      merchant_id: merchantId(),
      amount: opts.amount * 10, // تومان → ریال
      authority: opts.authority,
    }),
  });
  const json = await res.json().catch(() => null);
  const code = json?.data?.code as number | undefined;
  const refId = json?.data?.ref_id != null ? String(json.data.ref_id) : null;
  return {
    ok: code === 100 || code === 101,
    refId,
    alreadyVerified: code === 101,
  };
}
