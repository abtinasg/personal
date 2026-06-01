import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const CHALLENGE_COOKIE = "zendegi_challenge";

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET تنظیم نشده است.");
  return new TextEncoder().encode(s);
}

/** نام نمایشی اپ که در دیالوگ پسکی نشان داده می‌شود. */
export const rpName = process.env.NEXT_PUBLIC_APP_NAME || "یک‌درصد";

/** rpID و origin را از روی هدرهای درخواست استخراج می‌کند. */
export function getRpInfo(req: Request): { rpID: string; origin: string } {
  const host =
    req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const proto =
    req.headers.get("x-forwarded-proto") ||
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  const rpID = host.split(":")[0];
  const origin = `${proto}://${host}`;
  return { rpID, origin };
}

type ChallengePayload = {
  challenge: string;
  // برای ثبت‌نام:
  username?: string;
  newUserId?: string;
  kind: "register" | "login";
};

export async function setChallenge(payload: ChallengePayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(secret());

  const store = await cookies();
  store.set(CHALLENGE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 300,
  });
}

export async function getChallenge(): Promise<ChallengePayload | null> {
  const store = await cookies();
  const token = store.get(CHALLENGE_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as ChallengePayload;
  } catch {
    return null;
  }
}

export async function clearChallenge() {
  const store = await cookies();
  store.delete(CHALLENGE_COOKIE);
}
