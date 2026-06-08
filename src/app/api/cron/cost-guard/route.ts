import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { aiSpendToday } from "@/lib/metrics";
import { getFlag, isEnabled, setFlag } from "@/lib/flags";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * نگهبانِ هزینه‌ی هوش مصنوعی.
 *
 * خرجِ تخمینیِ امروز را حساب می‌کند؛ اگر فلگِ ai_daily_budget روشن باشد و خرج از
 * سقفِ value.toman بگذرد و هوش مصنوعی هنوز فعال باشد، کلیدِ ai_enabled را به‌صورتِ
 * خودکار می‌اندازد و در ممیزی (actor='system') ثبت می‌کند. به‌خاطرِ ایمنی، روشن‌کردنِ
 * دوباره دستی است (تا فردا قفل نماند، ادمین آگاهانه باز می‌کند).
 *
 * با هدرِ Authorization: Bearer <CRON_SECRET> یا ?secret= صدا بزن.
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
  const budget = await getFlag(db, "ai_daily_budget");
  const limitToman = Number(budget?.value?.toman ?? 0) || 0;

  const spend = await aiSpendToday(db);

  // بودجه خاموش یا تنظیم‌نشده → فقط گزارش بده.
  if (!budget?.enabled || limitToman <= 0) {
    return NextResponse.json({ ok: true, tripped: false, reason: "budget_off", spend, limitToman });
  }

  const overBudget = spend.toman >= limitToman;
  const aiOn = await isEnabled(db, "ai_enabled");

  if (overBudget && aiOn) {
    await setFlag(db, "ai_enabled", { enabled: false }, "system");
    await logAudit(db, {
      actor: "system",
      action: "ai_auto_kill",
      targetTable: "feature_flags",
      targetId: "ai_enabled",
      meta: { spendToman: spend.toman, limitToman, calls: spend.calls },
    });
    return NextResponse.json({ ok: true, tripped: true, spend, limitToman });
  }

  return NextResponse.json({ ok: true, tripped: false, overBudget, aiOn, spend, limitToman });
}

export const GET = handle;
export const POST = handle;
