import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { settlePayment, type SettleablePayment } from "@/lib/billing";
import { verifyPayment } from "@/lib/zibal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * کرانِ تطبیقِ پرداخت.
 *
 * callbackِ زیبال مرورگرمحور است: اگر کاربر بعد از پرداختِ موفق به اپ برنگردد
 * (تب را ببندد، اینترنت قطع شود، ریدایرکت بخورد)، پول کسر شده ولی اشتراک هرگز
 * فعال نمی‌شد. این کران هر چند دقیقه پرداخت‌های «در انتظار» را از زیبال استعلام
 * می‌کند و آن‌هایی که واقعاً پرداخت شده‌اند را — به‌صورتِ idempotent — نهایی می‌کند.
 *
 * با هدرِ Authorization: Bearer <CRON_SECRET> یا ?secret= صدا بزن.
 * زمان‌بندی روی ArvanCloud Container Service از طریقِ scheduled jobs ست می‌شود
 * (به docs/arvan-cron.md نگاه کن).
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  const provided =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    url.searchParams.get("secret") ||
    "";
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getServiceClient();
  const now = Date.now();
  // کمی صبر می‌کنیم تا فلوی عادیِ callback فرصتِ نهایی‌سازی داشته باشد.
  const twoMinAgo = new Date(now - 2 * 60 * 1000).toISOString();
  // پنجره‌ی استعلام: ۲۴ ساعت (بعد از آن trackId معمولاً قابلِ verify نیست).
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const { data: pending } = await db
    .from("payments")
    .select("id, user_id, amount, credits, status, plan, cycle, authority, created_at")
    .eq("status", "pending")
    .lt("created_at", twoMinAgo)
    .gte("created_at", dayAgo)
    .limit(100);

  let checked = 0;
  let settled = 0;

  for (const p of (pending ?? []) as Array<SettleablePayment & { authority: string | null }>) {
    if (!p.authority) continue;
    checked++;
    let verified;
    try {
      verified = await verifyPayment({ authority: p.authority, amount: p.amount });
    } catch {
      continue; // اشکالِ موقتِ شبکه — دفعه‌ی بعد دوباره
    }
    if (verified.amountMismatch) {
      await db.from("payments").update({ status: "failed" }).eq("id", p.id);
      continue;
    }
    if (verified.ok) {
      const claimed = await settlePayment(db, p, verified.refId);
      if (claimed) settled++;
    }
    // اگر هنوز پرداخت نشده باشد، دست‌نخورده می‌ماند تا دفعه‌ی بعد یا انقضا.
  }

  // پاک‌سازی: پرداخت‌های در انتظارِ قدیمی‌تر از پنجره‌ی استعلام را منقضی علامت بزن.
  await db.from("payments").update({ status: "expired" }).eq("status", "pending").lt("created_at", dayAgo);

  return NextResponse.json({ ok: true, checked, settled });
}

export const GET = handle;
export const POST = handle;
