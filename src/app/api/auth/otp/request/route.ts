import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { normalizePhone, generateOtp, hashOtp, sendOtpSms } from "@/lib/sms";

export const runtime = "nodejs";

const RESEND_COOLDOWN_MS = 60 * 1000; // حداقل فاصلهٔ ارسال مجدد: ۶۰ ثانیه
const CODE_TTL_MS = 2 * 60 * 1000; // اعتبار کد: ۲ دقیقه

export async function POST(req: Request) {
  const { phone } = await req.json().catch(() => ({}));
  const normalized = normalizePhone(String(phone || ""));

  if (!normalized) {
    return NextResponse.json(
      { error: "شمارهٔ موبایل معتبر نیست." },
      { status: 400 }
    );
  }

  const db = getServiceClient();

  // ضدِاسپم + ذخیرهٔ کد — هر دو در یک query
  const { data: existing } = await db
    .from("phone_otps")
    .select("last_sent_at")
    .eq("phone", normalized)
    .maybeSingle();

  if (existing?.last_sent_at) {
    const elapsed = Date.now() - new Date(existing.last_sent_at).getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
      return NextResponse.json(
        { error: `کمی صبر کن، تا ${wait} ثانیهٔ دیگر می‌توانی دوباره کد بگیری.` },
        { status: 429 }
      );
    }
  }

  const code = generateOtp(5);
  const now = new Date();

  const { error: upErr } = await db.from("phone_otps").upsert({
    phone: normalized,
    code_hash: hashOtp(code),
    expires_at: new Date(now.getTime() + CODE_TTL_MS).toISOString(),
    attempts: 0,
    last_sent_at: now.toISOString(),
  });

  if (upErr) {
    return NextResponse.json(
      { error: "خطا در ثبت کد. دوباره تلاش کن." },
      { status: 500 }
    );
  }

  try {
    await sendOtpSms(normalized, code);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "ارسال پیامک ناموفق بود." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, ttl: CODE_TTL_MS / 1000 });
}
