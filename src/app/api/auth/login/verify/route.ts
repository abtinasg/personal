import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { getServiceClient } from "@/lib/supabase";
import { createSession } from "@/lib/auth";
import { clearChallenge, getChallenge, getRpInfo } from "@/lib/webauthn";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const authResp = body?.response;
  if (!authResp?.id) {
    return NextResponse.json({ error: "پاسخ نامعتبر است." }, { status: 400 });
  }

  const challenge = await getChallenge();
  if (!challenge || challenge.kind !== "login") {
    return NextResponse.json({ error: "نشست ورود منقضی شده. دوباره تلاش کن." }, { status: 400 });
  }

  const db = getServiceClient();
  const { data: cred } = await db
    .from("credentials")
    .select("id, user_id, public_key, counter, transports")
    .eq("id", authResp.id)
    .maybeSingle();

  if (!cred) {
    return NextResponse.json({ error: "این پسکی شناخته نشد." }, { status: 404 });
  }

  const { data: user } = await db
    .from("users")
    .select("id, username")
    .eq("id", cred.user_id)
    .maybeSingle();
  if (!user) {
    return NextResponse.json({ error: "کاربر یافت نشد." }, { status: 404 });
  }

  const { rpID, origin } = getRpInfo(req);

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: authResp,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
      credential: {
        id: cred.id,
        publicKey: new Uint8Array(Buffer.from(cred.public_key, "base64url")),
        counter: Number(cred.counter),
        transports: cred.transports ?? undefined,
      },
    });
  } catch {
    return NextResponse.json({ error: "تأیید پسکی ناموفق بود." }, { status: 400 });
  }

  if (!verification.verified) {
    return NextResponse.json({ error: "پسکی تأیید نشد." }, { status: 400 });
  }

  await db
    .from("credentials")
    .update({
      counter: verification.authenticationInfo.newCounter,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", cred.id);

  await clearChallenge();
  await createSession({ uid: user.id, username: user.username });

  return NextResponse.json({ ok: true });
}
