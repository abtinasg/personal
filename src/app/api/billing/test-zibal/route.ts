import { authed, bad, ok } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  const a = await authed();
  if ("error" in a) return a.error;

  const merchantId = process.env.ZIBAL_MERCHANT_ID;
  const isSandbox = process.env.ZIBAL_SANDBOX === "1";

  try {
    const testRes = await fetch("https://gateway.zibal.ir/v1/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merchant: isSandbox ? "zibal" : merchantId,
        amount: 10000, // 1000 تومان = 10000 ریال
        callbackUrl: "http://localhost:3000/api/billing/callback",
        description: "تستِ اتصالِ زیبال",
      }),
    });

    const json = await testRes.json().catch(() => null);

    return ok({
      merchantIdSet: !!merchantId,
      isSandbox,
      statusCode: testRes.status,
      response: json,
      ok: testRes.ok,
    });
  } catch (e) {
    return bad(
      `خطاِ شبکهٔ زیبال: ${e instanceof Error ? e.message : String(e)}`,
      502
    );
  }
}
