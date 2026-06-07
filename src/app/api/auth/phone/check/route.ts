import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { normalizePhone } from "@/lib/sms";

export const runtime = "nodejs";

/** بررسی می‌کند آیا این شماره ثبت شده و رمز عبور دارد یا نه. */
export async function POST(req: Request) {
  const { phone } = await req.json().catch(() => ({}));
  const normalized = normalizePhone(String(phone || ""));

  if (!normalized) {
    return NextResponse.json({ error: "شمارهٔ موبایل معتبر نیست." }, { status: 400 });
  }

  const db = getServiceClient();
  const { data: user } = await db
    .from("users")
    .select("password_hash")
    .eq("phone", normalized)
    .maybeSingle();

  return NextResponse.json({ exists: !!user, hasPassword: !!user?.password_hash });
}
