import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { settlePayment } from "@/lib/billing";
import { verifyPayment } from "@/lib/zibal";

export const runtime = "nodejs";

/**
 * زرین‌پال بعد از پرداخت، مرورگرِ کاربر را با ?Authority=&Status=OK به اینجا
 * برمی‌گرداند. این مسیر را همان مرورگر صدا می‌زند (نه سرورِ زرین‌پال).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = (process.env.NEXT_PUBLIC_BASE_URL || `${url.protocol}//${url.host}`).replace(/\/$/, "");
  const authority = url.searchParams.get("trackId") || "";
  const success = url.searchParams.get("success") || "";

  const fail = (reason: string) =>
    NextResponse.redirect(`${origin}/wallet?status=failed&reason=${encodeURIComponent(reason)}`);

  if (!authority) return fail("nodata");

  const db = getServiceClient();
  const { data: payment } = await db
    .from("payments")
    .select("id, user_id, amount, credits, status, plan, cycle")
    .eq("authority", authority)
    .maybeSingle();

  if (!payment) return fail("notfound");

  const successUrl = payment.plan
    ? `${origin}/wallet?status=success&plan=${encodeURIComponent(payment.plan)}`
    : `${origin}/wallet?status=success&credits=${payment.credits}`;

  // قبلاً موفق شده — دوباره فعال نکن (idempotent)
  if (payment.status === "paid") {
    return NextResponse.redirect(successUrl);
  }

  if (success !== "1") {
    await db.from("payments").update({ status: "canceled" }).eq("id", payment.id);
    return fail("canceled");
  }

  let verified;
  try {
    verified = await verifyPayment({ authority, amount: payment.amount });
  } catch {
    return fail("verify");
  }

  if (!verified.ok) {
    // مبلغِ ناهماهنگ هم همین‌جا fail می‌شود (دست‌کاریِ مبلغ).
    await db.from("payments").update({ status: "failed" }).eq("id", payment.id);
    return fail(verified.amountMismatch ? "amount" : "verify");
  }

  // نهایی‌سازیِ اتمیک و idempotent (مشترک با کرانِ تطبیق).
  await settlePayment(db, payment, verified.refId);

  return NextResponse.redirect(successUrl);
}
