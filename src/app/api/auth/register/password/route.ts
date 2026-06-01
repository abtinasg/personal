import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { hashPassword } from "@/lib/password";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { username, password } = await req.json().catch(() => ({}));
  const uname = String(username || "").trim().toLowerCase();

  if (!uname || uname.length < 2) {
    return NextResponse.json(
      { error: "نام کاربری باید حداقل ۲ کاراکتر باشد." },
      { status: 400 }
    );
  }

  if (!password || password.length < 6) {
    return NextResponse.json(
      { error: "رمز عبور باید حداقل ۶ کاراکتر باشد." },
      { status: 400 }
    );
  }

  const db = getServiceClient();
  const { data: existing } = await db
    .from("users")
    .select("id")
    .eq("username", uname)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "این نام کاربری قبلاً ثبت شده است." },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);

  const { data: newUser, error } = await db
    .from("users")
    .insert({
      username: uname,
      password_hash: passwordHash,
    })
    .select("id, username")
    .single();

  if (error || !newUser) {
    return NextResponse.json(
      { error: "خطا در ساخت حساب. دوباره تلاش کن." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, user: newUser });
}
