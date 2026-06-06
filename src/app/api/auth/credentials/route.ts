import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { createSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const adminUser = process.env.ADMIN_USERNAME;
  const adminPass = process.env.ADMIN_PASSWORD;

  if (!adminUser || !adminPass) {
    return NextResponse.json({ error: "ورود با رمز عبور فعال نیست." }, { status: 403 });
  }

  const { username, password } = await req.json().catch(() => ({}));

  if (String(username || "") !== adminUser || String(password || "") !== adminPass) {
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

  if (!user) {
    return NextResponse.json({ error: "خطا در ساخت حساب." }, { status: 500 });
  }

  await createSession({ uid: user.id, username: user.username || adminUser });
  return NextResponse.json({ ok: true });
}
