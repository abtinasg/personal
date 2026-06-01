import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { getServiceClient } from "@/lib/supabase";
import { createSession } from "@/lib/auth";
import { clearChallenge, getChallenge, getRpInfo } from "@/lib/webauthn";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const attResp = body?.response;
  const displayName = body?.displayName as string | undefined;

  const challenge = await getChallenge();
  if (!challenge || challenge.kind !== "register" || !challenge.newUserId || !challenge.username) {
    return NextResponse.json({ error: "نشست ثبت‌نام منقضی شده. دوباره تلاش کن." }, { status: 400 });
  }

  const { rpID, origin } = getRpInfo(req);

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: attResp,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });
  } catch (e) {
    return NextResponse.json({ error: "تأیید پسکی ناموفق بود." }, { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "پسکی تأیید نشد." }, { status: 400 });
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  const db = getServiceClient();

  // ساخت کاربر
  const { error: userErr } = await db.from("users").insert({
    id: challenge.newUserId,
    username: challenge.username,
    display_name: displayName || challenge.username,
  });
  if (userErr) {
    return NextResponse.json({ error: "ساخت کاربر ناموفق بود: " + userErr.message }, { status: 500 });
  }

  // پروفایل پیش‌فرض
  await db.from("profiles").insert({ user_id: challenge.newUserId });

  // ذخیره‌ی پسکی
  const { error: credErr } = await db.from("credentials").insert({
    id: credential.id,
    user_id: challenge.newUserId,
    public_key: Buffer.from(credential.publicKey).toString("base64url"),
    counter: credential.counter,
    transports: credential.transports ?? null,
    device_type: credentialDeviceType,
    backed_up: credentialBackedUp,
  });
  if (credErr) {
    // پاکسازی کاربر نیمه‌ساخته
    await db.from("users").delete().eq("id", challenge.newUserId);
    return NextResponse.json({ error: "ذخیره‌ی پسکی ناموفق بود." }, { status: 500 });
  }

  await clearChallenge();
  await createSession({ uid: challenge.newUserId, username: challenge.username });

  return NextResponse.json({ ok: true });
}
