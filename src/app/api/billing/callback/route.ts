import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { addCredits, activateSubscription, planDays } from "@/lib/billing";
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
    await db.from("payments").update({ status: "failed" }).eq("id", payment.id);
    return fail("verify");
  }

  // علامت‌گذاریِ پرداخت به‌صورتِ شرطی تا در شرایطِ همزمانی دوبار شارژ نشود
  const { data: claimed } = await db
    .from("payments")
    .update({ status: "paid", ref_id: verified.refId, paid_at: new Date().toISOString() })
    .eq("id", payment.id)
    .neq("status", "paid")
    .select("id")
    .maybeSingle();

  if (claimed) {
    if (payment.plan && payment.cycle) {
      // پرداختِ پلن → اشتراک را فعال/تمدید کن (نه اعتبار)
      await activateSubscription(db, payment.user_id, payment.plan, payment.cycle, planDays(payment.cycle));
    } else {
      // سازگاریِ عقب‌رو: بسته‌ی اعتباریِ قدیمی
      await addCredits(db, payment.user_id, payment.credits, "purchase");
    }
  }

  return NextResponse.redirect(successUrl);
}
