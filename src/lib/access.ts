import type { getServiceClient } from "@/lib/supabase";
import { normalizeRole, isBootstrapOwner, type Role } from "@/lib/roles";

type DB = ReturnType<typeof getServiceClient>;

/**
 * نقشِ مؤثرِ کاربر را از دیتابیس می‌خواند (منبعِ حقیقتِ دسترسی).
 *
 * - بوت‌استرپ: اگر username برابرِ ADMIN_USERNAME باشد، owner است و اگر در DB
 *   هنوز owner نیست، یک‌بار به owner ارتقا داده می‌شود (تا تیم قفل نشود).
 * - مقاوم در برابرِ نبودِ ستون: اگر مهاجرت ۰۱۵ هنوز اجرا نشده باشد (خطای ستون)،
 *   فقط بوت‌استرپ owner شناخته می‌شود و بقیه user — بدونِ logoutِ اشتباهی.
 *
 * خروجی: نقش، یا null اگر کاربر اصلاً وجود نداشته باشد (سشنِ یتیم).
 */
export async function resolveRole(
  db: DB,
  uid: string,
  username: string
): Promise<Role | null> {
  const { data, error } = await db.from("users").select("id, role").eq("id", uid).maybeSingle();

  // ستونِ role وجود ندارد (مهاجرت اجرا نشده) یا خطای گذرا → فقط بوت‌استرپ.
  if (error) return isBootstrapOwner(username) ? "owner" : "user";

  if (!data) return null; // سشنِ یتیم

  let role = normalizeRole((data as { role?: unknown }).role);

  if (isBootstrapOwner(username)) {
    if (role !== "owner") {
      role = "owner";
      try {
        await db.from("users").update({ role: "owner" }).eq("id", uid);
      } catch {
        // ارتقای تنبل بهترین‌تلاش است؛ دسترسی به‌هرحال owner می‌ماند.
      }
    }
  }

  return role;
}
