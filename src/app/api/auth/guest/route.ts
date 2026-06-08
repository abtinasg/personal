import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { createSession } from "@/lib/auth";
import { logEvent } from "@/lib/events";
import { isEnabled } from "@/lib/flags";

export const runtime = "nodejs";

// سقفِ ساختِ مهمان از یک IP — جلوی ساختِ انبوهِ کاربر برای دور زدنِ سهمیه‌ی رایگانِ
// هوش مصنوعی را می‌گیرد. از env قابلِ تنظیم.
const GUEST_PER_HOUR = Number(process.env.GUEST_PER_HOUR) || 5;
const GUEST_PER_DAY = Number(process.env.GUEST_PER_DAY) || 20;

/** IPِ کلاینت را از هدرهای پراکسی (Vercel) بیرون می‌کشد. */
function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * ورودِ مهمان («اول بچش، بعد ثبت‌نام»). یک کاربرِ موقت بدونِ شماره می‌سازد،
 * نشست برایش باز می‌کند و پروفایلش را «آشنا‌شده» علامت می‌زند تا مستقیم
 * وارد اپ شود. وقتی بعداً شماره بدهد، همین ردیف ارتقا می‌یابد (claim) و
 * همه‌ی داده‌هایش حفظ می‌شود.
 */
export async function POST(req: Request) {
  const db = getServiceClient();

  // ── کلیدِ قطعِ ثبت‌نام (و maintenance_mode) ──
  if (!(await isEnabled(db, "signups_enabled"))) {
    return NextResponse.json(
      { error: "ثبت‌نام موقتاً بسته است. کمی بعد دوباره سر بزن. 🌱", code: "SIGNUPS_DISABLED" },
      { status: 503 }
    );
  }

  // ── ضدِسوءاستفاده: سقفِ ساختِ مهمان از این IP ──
  const ip = clientIp(req);
  const now = Date.now();
  const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const [{ count: lastHour }, { count: lastDay }] = await Promise.all([
    db.from("guest_signups").select("id", { count: "exact", head: true }).eq("ip", ip).gte("created_at", hourAgo),
    db.from("guest_signups").select("id", { count: "exact", head: true }).eq("ip", ip).gte("created_at", dayAgo),
  ]);

  if ((lastHour ?? 0) >= GUEST_PER_HOUR || (lastDay ?? 0) >= GUEST_PER_DAY) {
    return NextResponse.json(
      { error: "تعدادِ ورودِ مهمان از این دستگاه زیاد شد. کمی بعد دوباره امتحان کن یا با شماره وارد شو." },
      { status: 429 }
    );
  }

  const suffix = Math.random().toString(36).slice(2, 10);
  const username = `guest_${suffix}`;

  const { data: user, error } = await db
    .from("users")
    .insert({ username, is_guest: true })
    .select("id, username")
    .single();

  if (error || !user) {
    return NextResponse.json({ error: "خطا در ساختِ کاربرِ مهمان. دوباره تلاش کن." }, { status: 500 });
  }

  // ثبتِ این ساخت برای شمارشِ سقفِ IP در دفعاتِ بعد.
  await db.from("guest_signups").insert({ ip });

  // پروفایلِ آماده تا مرحله‌ی آشناییِ بدنی نگیرد و سریع به مربی برسد.
  await db.from("profiles").upsert({ user_id: user.id, onboarded: true }, { onConflict: "user_id" });

  await logEvent(db, "guest_start", { userId: user.id as string, ip });

  await createSession({ uid: user.id, username: user.username });
  return NextResponse.json({ ok: true });
}
