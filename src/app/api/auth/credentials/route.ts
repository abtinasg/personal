import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { createSession } from "@/lib/auth";
import { normalizeUsername, verifyPassword } from "@/lib/password";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { username, password } = await req.json().catch(() => ({}));
  const uname = normalizeUsername(String(username || ""));
  const pass = String(password || "");

  if (!uname || !pass) {
    return NextResponse.json({ error: "نام کاربری و رمز عبور را وارد کن." }, { status: 400 });
  }

  // ---------- ورود ادمین با نام کاربری/رمزِ محیطی ----------
  const adminUser = process.env.ADMIN_USERNAME;
  const adminPass = process.env.ADMIN_PASSWORD;
  if (adminUser && adminPass && uname === normalizeUsername(adminUser)) {
    if (pass !== adminPass) {
      return NextResponse.json({ error: "نام کاربری یا رمز عبور اشتباه است." }, { status: 401 });
    }
    const db = getServiceClient();
    let { data: user } = await db
      .from("users")
      .select("id, username")
      .eq("username", adminUser)
      .maybeSingle();
    if (!user) {
      const { data: created } = await db
        .from("users")
        .insert({ username: adminUser })
        .select("id, username")
        .single();
      user = created;
    }
    if (!user) return NextResponse.json({ error: "خطا در ساخت حساب." }, { status: 500 });
    await createSession({ uid: user.id, username: user.username || adminUser });
    return NextResponse.json({ ok: true });
  }

  // ---------- ورود کاربر با نام کاربری + رمز عبور ----------
  const db = getServiceClient();
  const { data: user } = await db
    .from("users")
    .select("id, username, password_hash")
    .eq("username", uname)
    .maybeSingle();

  if (!user || !user.password_hash || !verifyPassword(pass, user.password_hash)) {
    return NextResponse.json({ error: "نام کاربری یا رمز عبور اشتباه است." }, { status: 401 });
  }

  await createSession({ uid: user.id, username: user.username || uname });
  return NextResponse.json({ ok: true });
}
