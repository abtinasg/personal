import { NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

/** uid کاربر را برمی‌گرداند یا یک Response خطای 401. */
export async function authed(): Promise<
  { uid: string; username: string; db: ReturnType<typeof getServiceClient> } | { error: NextResponse }
> {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: "وارد نشده‌اید." }, { status: 401 }) };
  }
  return { uid: session.uid, username: session.username, db: getServiceClient() };
}

/** مثلِ authed اما فقط برای کاربرِ ادمین؛ در غیر این صورت 403 برمی‌گرداند. */
export async function adminAuthed(): Promise<
  { uid: string; username: string; db: ReturnType<typeof getServiceClient> } | { error: NextResponse }
> {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: "وارد نشده‌اید." }, { status: 401 }) };
  }
  if (!isAdmin(session)) {
    return { error: NextResponse.json({ error: "دسترسی مجاز نیست." }, { status: 403 }) };
  }
  return { uid: session.uid, username: session.username, db: getServiceClient() };
}

export function ok(data: unknown = { ok: true }) {
  return NextResponse.json(data);
}

export function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
