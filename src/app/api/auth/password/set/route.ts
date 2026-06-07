import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { hashPassword, validatePassword } from "@/lib/password";

export const runtime = "nodejs";

/** تعیین/تغییرِ رمز عبور برای کاربرِ واردشده (نشستِ فعال لازم است). */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "ابتدا وارد شو." }, { status: 401 });
  }

  const { password } = await req.json().catch(() => ({}));
  const pass = String(password || "");

  const invalid = validatePassword(pass);
  if (invalid) {
    return NextResponse.json({ error: invalid }, { status: 400 });
  }

  const db = getServiceClient();
  const { error } = await db
    .from("users")
    .update({ password_hash: hashPassword(pass) })
    .eq("id", session.uid);

  if (error) {
    return NextResponse.json({ error: "خطا در ذخیرهٔ رمز عبور." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
