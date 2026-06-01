import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const COOKIE = "zendegi_session";
const MAX_AGE = 60 * 60 * 24 * 30; // ۳۰ روز

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET تنظیم نشده است.");
  return new TextEncoder().encode(s);
}

export type Session = { uid: string; username: string };

export async function createSession(session: Session) {
  const token = await new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.uid === "string" && typeof payload.username === "string") {
      return { uid: payload.uid, username: payload.username };
    }
    return null;
  } catch {
    return null;
  }
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE);
}

/** برای route handler ها: کاربر را برمی‌گرداند یا null. */
export async function requireUser(): Promise<Session | null> {
  return getSession();
}
