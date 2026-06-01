import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { username, password } = await req.json().catch(() => ({}));
  const uname = String(username || "").trim().toLowerCase();

  if (!uname || !password) {
    return NextResponse.json(
      { error: "نام کاربری و رمز عبور الزامی است." },
      { status: 400 }
    );
  }

  const db = getServiceClient();
  const { data: user } = await db
    .from("users")
    .select("id, username, password_hash")
    .eq("username", uname)
    .maybeSingle();

  if (!user || !user.password_hash) {
    return NextResponse.json(
      { error: "نام کاربری یا رمز عبور نادرست است." },
      { status: 401 }
    );
  }

  try {
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { error: "نام کاربری یا رمز عبور نادرست است." },
        { status: 401 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "خطا در تأیید رمز عبور." },
      { status: 500 }
    );
  }

  await createSession({ uid: user.id, username: user.username });

  return NextResponse.json({ ok: true });
}
