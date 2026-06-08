import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * هلث‌چکِ بدونِ احرازِ هویت برای مانیتورینگِ بیرونی (UptimeRobot و …).
 *
 * توجه: مسیرِ /api/health مربوط به دیتای سلامتِ کاربر است و auth می‌خواهد؛ این
 * مسیر فرق دارد — فقط می‌گوید «اپ بالاست و دیتابیس جواب می‌دهد». یک ping سبک به
 * Postgres می‌زند و تأخیرش را برمی‌گرداند. اگر دیتابیس قطع باشد ۵۰۳ می‌دهد تا
 * مانیتور آلارم بزند.
 */
export async function GET() {
  const started = Date.now();
  try {
    const db = getServiceClient();
    await db.query("select 1 as ok");
    return NextResponse.json({
      status: "ok",
      db: "up",
      latencyMs: Date.now() - started,
      ts: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      {
        status: "error",
        db: "down",
        error: e instanceof Error ? e.message : String(e),
        latencyMs: Date.now() - started,
        ts: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
