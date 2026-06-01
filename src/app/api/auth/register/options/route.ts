import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { getServiceClient } from "@/lib/supabase";
import { getRpInfo, rpName, setChallenge } from "@/lib/webauthn";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { username, displayName } = await req.json().catch(() => ({}));
  const uname = String(username || "").trim().toLowerCase();

  if (!uname || uname.length < 2) {
    return NextResponse.json({ error: "نام کاربری باید حداقل ۲ کاراکتر باشد." }, { status: 400 });
  }

  const db = getServiceClient();
  const { data: existing } = await db.from("users").select("id").eq("username", uname).maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "این نام کاربری قبلاً ثبت شده است." }, { status: 409 });
  }

  const { rpID } = getRpInfo(req);
  const newUserId = crypto.randomUUID();

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new TextEncoder().encode(newUserId),
    userName: uname,
    userDisplayName: String(displayName || uname),
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  await setChallenge({
    challenge: options.challenge,
    username: uname,
    newUserId,
    kind: "register",
  });

  return NextResponse.json({ options, displayName: String(displayName || uname) });
}
