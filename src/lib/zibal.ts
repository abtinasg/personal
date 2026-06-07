const SANDBOX = process.env.ZIBAL_SANDBOX === "1";
const BASE = "https://gateway.zibal.ir";

function merchantId(): string {
  if (SANDBOX) return "zibal";
  const id = process.env.ZIBAL_MERCHANT_ID;
  if (!id) {
    throw new Error(
      "مرچنت‌آیدیِ زیبال تنظیم نشده. ZIBAL_MERCHANT_ID را در .env قرار بده."
    );
  }
  return id;
}

/** صفحهٔ پرداختی که کاربر به آن ریدایرکت می‌شود. */
export function startPayUrl(trackId: string): string {
  return `${BASE}/start/${trackId}`;
}

/**
 * درخواستِ پرداخت. مبلغ به تومان. در صورتِ موفقیت trackId و آدرسِ پرداخت برمی‌گرداند.
 */
export async function requestPayment(opts: {
  amount: number; // تومان
  description: string;
  callbackUrl: string;
  mobile?: string;
}): Promise<{ authority: string; payUrl: string }> {
  const res = await fetch(`${BASE}/v1/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      merchant: merchantId(),
      amount: opts.amount * 10, // تومان → ریال
      callbackUrl: opts.callbackUrl,
      description: opts.description,
      ...(opts.mobile ? { mobile: opts.mobile } : {}),
    }),
  });
  const json = await res.json().catch(() => null);
  const trackId = json?.trackId != null ? String(json.trackId) : undefined;
  if (!res.ok || !trackId || json?.result !== 100) {
    const code = json?.result ?? res.status;
    throw new Error(`خطا از زیبال هنگامِ ساختِ پرداخت (${code}).`);
  }
  return { authority: trackId, payUrl: startPayUrl(trackId) };
}

/**
 * تاییدِ پرداخت بعد از بازگشتِ کاربر.
 * result=100 یعنی موفق، result=201 یعنی قبلاً تایید شده.
 */
export async function verifyPayment(opts: {
  authority: string; // همان trackId
  amount: number; // تومان (برای سازگاری — زیبال نیازی به آن ندارد)
}): Promise<{ ok: boolean; refId: string | null; alreadyVerified: boolean }> {
  const res = await fetch(`${BASE}/v1/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      merchant: merchantId(),
      trackId: opts.authority,
    }),
  });
  const json = await res.json().catch(() => null);
  const result = json?.result as number | undefined;
  const refId = json?.refNumber != null ? String(json.refNumber) : null;
  return {
    ok: result === 100 || result === 201,
    refId,
    alreadyVerified: result === 201,
  };
}
