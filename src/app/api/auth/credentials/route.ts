import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { createSession } from "@/lib/auth";
import { normalizePhone } from "@/lib/sms";
import { verifyPassword } from "@/lib/password";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { username, password } = await req.json().catch(() => ({}));
  const pass = String(password || "");

  // ---------- ورود ادمین با نام کاربری/رمزِ محیطی ----------
  const adminUser = process.env.ADMIN_USERNAME;
  const adminPass = process.env.ADMIN_PASSWORD;
  if (adminUser && adminPass && String(username || "") === adminUser) {
    if (pass !== adminPass) {
      return NextResponse.json({ error: "نام کاربری یا رمز عبور اشتباه است." }, { status: 401 });
    }
    const db = getServiceClient();
    let { data: user } = await db
      .from("users")
      .select("id, username, phone")
      .eq("username", adminUser)
      .maybeSingle();
    if (!user) {
      const { data: created } = await db
        .from("users")
        .insert({ username: adminUser, phone: adminUser })
        .select("id, username, phone")
        .single();
      user = created;
    }
    if (!user) return NextResponse.json({ error: "خطا در ساخت حساب." }, { status: 500 });
    await createSession({ uid: user.id, username: user.username || adminUser });
    return NextResponse.json({ ok: true });
  }

  // ---------- ورود کاربر با شمارهٔ موبایل + رمز عبور ----------
  const normalized = normalizePhone(String(username || ""));
  if (!normalized) {
    return NextResponse.json({ error: "شمارهٔ موبایل معتبر نیست." }, { status: 400 });
  }
  if (!pass) {
    return NextResponse.json({ error: "رمز عبور را وارد کن." }, { status: 400 });
  }

  const db = getServiceClient();
  const { data: user } = await db
    .from("users")
    .select("id, username, phone, password_hash")
    .eq("phone", normalized)
    .maybeSingle();

  if (!user || !user.password_hash) {
    // کاربر هنوز رمز تعیین نکرده — با کد یک‌بارمصرف وارد شود و رمز بسازد.
    return NextResponse.json(
      { error: "برای این شماره رمزی تعیین نشده. با کد ورود و رمزت را بساز.", code: "no_password" },
      { status: 401 }
    );
  }

  if (!verifyPassword(pass, user.password_hash)) {
    return NextResponse.json({ error: "شماره یا رمز عبور اشتباه است." }, { status: 401 });
  }

  await createSession({ uid: user.id, username: user.username || normalized });
  return NextResponse.json({ ok: true });
}
