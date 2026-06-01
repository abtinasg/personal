import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { getServiceClient } from "@/lib/supabase";
import { getRpInfo, setChallenge } from "@/lib/webauthn";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { username } = await req.json().catch(() => ({}));
  const uname = String(username || "").trim().toLowerCase();
  const { rpID } = getRpInfo(req);

  // اگر نام کاربری داده شده، پسکی‌های همان کاربر را اجازه می‌دهیم؛
  // در غیر این صورت ورود بدون نام (discoverable / usernameless).
  let allowCredentials: { id: string; transports?: any }[] | undefined;
  if (uname) {
    const db = getServiceClient();
    const { data: user } = await db.from("users").select("id").eq("username", uname).maybeSingle();
    if (user) {
      const { data: creds } = await db
        .from("credentials")
        .select("id, transports")
        .eq("user_id", user.id);
      allowCredentials = (creds || []).map((c) => ({ id: c.id, transports: c.transports ?? undefined }));
    }
  }

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
    allowCredentials,
  });

  await setChallenge({ challenge: options.challenge, kind: "login" });

  return NextResponse.json({ options });
}
