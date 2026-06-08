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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 ثانیه تایم‌اوت

  try {
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
      signal: controller.signal,
    });
    const json = await res.json().catch(() => null);
    const trackId = json?.trackId != null ? String(json.trackId) : undefined;
    if (!res.ok || !trackId || json?.result !== 100) {
      const code = json?.result ?? res.status;
      const detailedMsg = json?.message || `وضعیتِ ${code}`;
      throw new Error(`خطا از زیبال: ${detailedMsg}`);
    }
    return { authority: trackId, payUrl: startPayUrl(trackId) };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("درخواستِ به زیبال پاسخ نداد. لطفاً دوباره تلاش کنید.");
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * تاییدِ پرداخت بعد از بازگشتِ کاربر.
 * result=100 یعنی موفق، result=201 یعنی قبلاً تایید شده.
 *
 * مبلغِ بازگشتی از زیبال (به ریال) را با مبلغِ موردِانتظار مقایسه می‌کنیم؛
 * اگر نخواند، پرداخت را نامعتبر می‌شماریم تا کسی نتواند با دست‌کاریِ مبلغ،
 * با پرداختِ کم‌تر اشتراک/اعتبار بگیرد.
 */
export async function verifyPayment(opts: {
  authority: string; // همان trackId
  amount: number; // تومان موردِانتظار (برای مقایسه با مبلغِ واقعیِ زیبال)
}): Promise<{ ok: boolean; refId: string | null; alreadyVerified: boolean; amountMismatch: boolean }> {
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
  const verified = result === 100 || result === 201;

  // زیبال مبلغ را به ریال برمی‌گرداند؛ موردِانتظارِ ما تومان است.
  const expectedRial = opts.amount * 10;
  const paidRial = typeof json?.amount === "number" ? json.amount : null;
  const amountMismatch = verified && paidRial != null && paidRial !== expectedRial;

  return {
    ok: verified && !amountMismatch,
    refId,
    alreadyVerified: result === 201,
    amountMismatch,
  };
}
