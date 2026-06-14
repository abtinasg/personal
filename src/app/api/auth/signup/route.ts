import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { createSession, getSession } from "@/lib/auth";
import { hashPassword, normalizeUsername, validatePassword, validateUsername } from "@/lib/password";
import { logEvent } from "@/lib/events";
import { isEnabled } from "@/lib/flags";

export const runtime = "nodejs";

/**
 * ثبت‌نام با نام کاربری + رمز عبور. اگر نشستِ مهمان فعال باشد، همان ردیف ارتقا
 * می‌یابد (claim) تا داده‌های ساخته‌شده در حالتِ مهمان حفظ شوند؛ وگرنه کاربرِ
 * تازه ساخته می‌شود.
 */
export async function POST(req: Request) {
  const { username, password } = await req.json().catch(() => ({}));
  const uname = normalizeUsername(String(username || ""));
  const pass = String(password || "");

  const unameErr = validateUsername(uname);
  if (unameErr) return NextResponse.json({ error: unameErr }, { status: 400 });

  const passErr = validatePassword(pass);
  if (passErr) return NextResponse.json({ error: passErr }, { status: 400 });

  const db = getServiceClient();

  // کلیدِ قطعِ ثبت‌نام (و maintenance_mode)
  if (!(await isEnabled(db, "signups_enabled"))) {
    return NextResponse.json(
      { error: "ثبت‌نام موقتاً بسته است. کمی بعد دوباره سر بزن. 🌱", code: "SIGNUPS_DISABLED" },
      { status: 503 }
    );
  }

  // نام کاربری نباید قبلاً گرفته شده باشد.
  const { data: taken } = await db
    .from("users")
    .select("id")
    .eq("username", uname)
    .maybeSingle();
  if (taken) {
    return NextResponse.json({ error: "این نام کاربری قبلاً گرفته شده. یکی دیگر انتخاب کن." }, { status: 409 });
  }

  // اگر کاربرِ مهمان لاگین است، همین ردیف را ارتقا بده تا داده‌هایش حفظ شود.
  let guestId: string | null = null;
  const current = await getSession();
  if (current) {
    const { data: cu } = await db
      .from("users")
      .select("id, is_guest")
      .eq("id", current.uid)
      .maybeSingle();
    if (cu?.is_guest) guestId = cu.id as string;
  }

  const passwordHash = hashPassword(pass);

  let userId: string;
  if (guestId) {
    const { data: claimed, error: upErr } = await db
      .from("users")
      .update({ username: uname, password_hash: passwordHash, is_guest: false })
      .eq("id", guestId)
      .select("id")
      .single();
    if (upErr || !claimed) {
      return NextResponse.json({ error: "خطا در ذخیره‌ی حساب. دوباره تلاش کن." }, { status: 500 });
    }
    userId = claimed.id as string;
  } else {
    const { data: created, error: insErr } = await db
      .from("users")
      .insert({ username: uname, password_hash: passwordHash })
      .select("id")
      .single();
    if (insErr || !created) {
      return NextResponse.json({ error: "خطا در ساخت حساب. دوباره تلاش کن." }, { status: 500 });
    }
    userId = created.id as string;
  }

  await createSession({ uid: userId, username: uname });
  await logEvent(db, "signup", { userId });

  return NextResponse.json({ ok: true });
}
