import { adminAuthed, ok } from "@/lib/api";
import { capabilitiesOf, ROLE_FA } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * نقش و مجوزهای کاربرِ فعلیِ پنل — تا کلاینت دکمه‌های فراترازدسترسی را مخفی کند.
 * (اجرای واقعیِ کنترل‌دسترسی سمتِ سرور است؛ این فقط برای UI است.)
 */
export async function GET() {
  const a = await adminAuthed();
  if ("error" in a) return a.error;
  return ok({
    uid: a.uid,
    username: a.username,
    role: a.role,
    roleLabel: ROLE_FA[a.role],
    capabilities: capabilitiesOf(a.role),
  });
}
