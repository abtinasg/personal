import { NextResponse } from "next/server";
import { getSession, clearSession } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { resolveRole } from "@/lib/access";
import { can, type Capability, type Role } from "@/lib/roles";

export const runtime = "nodejs";

/**
 * بررسی می‌کند که uidِ سشن واقعاً در جدولِ users وجود دارد.
 * یک JWTِ معتبر ممکن است به کاربری اشاره کند که دیگر نیست (مثلاً بعد از مهاجرتِ
 * دیتابیس). در آن حالت اگر اجازه دهیم رد شود، هر INSERT با FK به users می‌ترکد و
 * کاربر همه‌جا «خطا در ثبت اطلاعات» می‌بیند. پس سشنِ یتیم را پاک و ۴۰۱ می‌دهیم تا
 * تمیز به صفحه‌ی ورود برگردد.
 */
async function userExists(db: ReturnType<typeof getServiceClient>, uid: string): Promise<boolean> {
  const { data } = await db.from("users").select("id").eq("id", uid).maybeSingle();
  return !!data;
}

async function orphanSessionResponse(): Promise<{ error: NextResponse }> {
  await clearSession();
  return { error: NextResponse.json({ error: "نشست منقضی شده. دوباره وارد شو." }, { status: 401 }) };
}

/** uid کاربر را برمی‌گرداند یا یک Response خطای 401. */
export async function authed(): Promise<
  { uid: string; username: string; db: ReturnType<typeof getServiceClient> } | { error: NextResponse }
> {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: "وارد نشده‌اید." }, { status: 401 }) };
  }
  const db = getServiceClient();
  if (!(await userExists(db, session.uid))) return orphanSessionResponse();
  return { uid: session.uid, username: session.username, db };
}

/**
 * گاردِ پنلِ مدیریت با کنترلِ دسترسیِ نقش‌محور (RBAC).
 *
 * cap حداقل مجوزِ موردِنیازِ این مسیر است (پیش‌فرض view_admin = دیدنِ پنل).
 * نقش از دیتابیس خوانده می‌شود (منبعِ حقیقت، نه از توکن) تا حذفِ دسترسی فوری
 * اثر کند. owner اولیه از طریقِ ADMIN_USERNAME بوت‌استرپ می‌شود.
 *
 * مثال‌ها:
 *   adminAuthed()                  → فقط دیدنِ پنل (support به بالا)
 *   adminAuthed("manage_users")    → فقط admin/owner
 *   adminAuthed("export_data")     → فقط owner
 */
export async function adminAuthed(cap: Capability = "view_admin"): Promise<
  { uid: string; username: string; role: Role; db: ReturnType<typeof getServiceClient> }
  | { error: NextResponse }
> {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: "وارد نشده‌اید." }, { status: 401 }) };
  }
  const db = getServiceClient();
  const role = await resolveRole(db, session.uid, session.username);
  if (role === null) return orphanSessionResponse();
  if (!can(role, cap)) {
    return { error: NextResponse.json({ error: "دسترسیِ کافی نداری." }, { status: 403 }) };
  }
  return { uid: session.uid, username: session.username, role, db };
}

export function ok(data: unknown = { ok: true }) {
  return NextResponse.json(data);
}

export function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
