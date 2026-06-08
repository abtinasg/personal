import { adminAuthed, ok, bad } from "@/lib/api";
import { ASSIGNABLE_ROLES, normalizeRole, type Role } from "@/lib/roles";
import { logAudit, clientIp } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: اعضای تیم (نقش غیر از user) برای مدیریتِ دسترسی. owner-only. */
export async function GET() {
  const a = await adminAuthed("manage_roles");
  if ("error" in a) return a.error;

  const { data, error } = await a.db
    .from("users")
    .select("id, username, phone, display_name, role, created_at")
    .neq("role", "user")
    .order("created_at", { ascending: false });
  if (error) return bad(error.message, 500);
  return ok({ team: data ?? [] });
}

/**
 * POST {userId, role}: تغییرِ نقشِ یک کاربر. فقط owner.
 * محافظت‌ها:
 *  - نقشِ معتبر باشد.
 *  - owner نمی‌تواند نقشِ خودش را پایین بیاورد (جلوگیری از قفلِ خودخواسته).
 *  - نمی‌توان آخرین owner را حذف کرد.
 */
export async function POST(req: Request) {
  const a = await adminAuthed("manage_roles");
  if ("error" in a) return a.error;

  const b = await req.json().catch(() => ({}));
  const userId = String(b?.userId ?? "").trim();
  const role = normalizeRole(b?.role) as Role;
  if (!userId) return bad("شناسه‌ی کاربر لازم است.");
  if (!ASSIGNABLE_ROLES.includes(role)) return bad("نقش نامعتبر است.");

  if (userId === a.uid && role !== "owner") {
    return bad("نمی‌توانی نقشِ خودت را پایین بیاوری.");
  }

  // اگر داریم یک owner را پایین می‌آوریم، مطمئن شو owner دیگری می‌ماند.
  const { data: target } = await a.db
    .from("users")
    .select("id, username, display_name, role")
    .eq("id", userId)
    .maybeSingle();
  if (!target) return bad("کاربر پیدا نشد.");

  if (target.role === "owner" && role !== "owner") {
    const { count } = await a.db
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("role", "owner");
    if ((count ?? 0) <= 1) return bad("حداقل یک مالک باید باقی بماند.");
  }

  const { error } = await a.db.from("users").update({ role }).eq("id", userId);
  if (error) return bad(error.message, 500);

  await logAudit(a.db, {
    actor: a.username,
    action: "set_role",
    targetTable: "users",
    targetId: userId,
    meta: { from: target.role, to: role, user: target.display_name || target.username },
    ip: clientIp(req),
  });

  return ok();
}
