import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { normalizePhone, hashOtp } from "@/lib/sms";
import { createSession } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_ATTEMPTS = 5; // حداکثر تلاشِ نادرستِ تأیید برای هر کد

export async function POST(req: Request) {
  const { phone, code } = await req.json().catch(() => ({}));
  const normalized = normalizePhone(String(phone || ""));
  const inputCode = String(code || "").replace(/\D/g, "");

  if (!normalized || inputCode.length < 4) {
    return NextResponse.json(
      { error: "شماره یا کد معتبر نیست." },
      { status: 400 }
    );
  }

  const db = getServiceClient();

  const { data: otp } = await db
    .from("phone_otps")
    .select("code_hash, expires_at, attempts")
    .eq("phone", normalized)
    .maybeSingle();

  if (!otp) {
    return NextResponse.json(
      { error: "کدی برای این شماره ثبت نشده. دوباره درخواست بده." },
      { status: 400 }
    );
  }

  if (new Date(otp.expires_at).getTime() < Date.now()) {
    await db.from("phone_otps").delete().eq("phone", normalized);
    return NextResponse.json(
      { error: "کد منقضی شده است. کد تازه بگیر." },
      { status: 400 }
    );
  }

  if (otp.attempts >= MAX_ATTEMPTS) {
    await db.from("phone_otps").delete().eq("phone", normalized);
    return NextResponse.json(
      { error: "تعداد تلاش‌ها زیاد شد. کد تازه بگیر." },
      { status: 429 }
    );
  }

  if (hashOtp(inputCode) !== otp.code_hash) {
    await db
      .from("phone_otps")
      .update({ attempts: otp.attempts + 1 })
      .eq("phone", normalized);
    return NextResponse.json({ error: "کد نادرست است." }, { status: 401 });
  }

  // کد درست — مصرف شد، حذفش کن.
  await db.from("phone_otps").delete().eq("phone", normalized);

  // کاربر را پیدا کن یا بساز.
  let { data: user } = await db
    .from("users")
    .select("id, username, phone")
    .eq("phone", normalized)
    .maybeSingle();

  if (!user) {
    const { data: created, error: insErr } = await db
      .from("users")
      .insert({ phone: normalized, username: normalized })
      .select("id, username, phone")
      .single();
    if (insErr || !created) {
      return NextResponse.json(
        { error: "خطا در ساخت حساب. دوباره تلاش کن." },
        { status: 500 }
      );
    }
    user = created;
  }

  await createSession({ uid: user.id, username: user.username || normalized });

  return NextResponse.json({ ok: true });
}
