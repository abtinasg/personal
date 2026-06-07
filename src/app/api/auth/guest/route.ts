import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { createSession } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * ورودِ مهمان («اول بچش، بعد ثبت‌نام»). یک کاربرِ موقت بدونِ شماره می‌سازد،
 * نشست برایش باز می‌کند و پروفایلش را «آشنا‌شده» علامت می‌زند تا مستقیم
 * وارد اپ شود. وقتی بعداً شماره بدهد، همین ردیف ارتقا می‌یابد (claim) و
 * همه‌ی داده‌هایش حفظ می‌شود.
 */
export async function POST() {
  const db = getServiceClient();

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

  // پروفایلِ آماده تا مرحله‌ی آشناییِ بدنی نگیرد و سریع به مربی برسد.
  await db.from("profiles").upsert({ user_id: user.id, onboarded: true }, { onConflict: "user_id" });

  await createSession({ uid: user.id, username: user.username });
  return NextResponse.json({ ok: true });
}
