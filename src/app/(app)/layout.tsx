import { redirect } from "next/navigation";
import { getSession, clearSession } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { normalizeRole, isStaff, isBootstrapOwner } from "@/lib/roles";
import AppChrome from "@/components/AppChrome";

export const dynamic = "force-dynamic";

/**
 * لایه‌ی مشترکِ همه‌ی صفحاتِ داخلِ اپ: احرازِ هویت + هدر/تب‌بار/ثبتِ سریع.
 * صفحاتِ ورود و لندینگ بیرونِ این گروه‌اند و این چارچوب را نمی‌گیرند.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  let displayName = session.username;
  let isGuest = false;
  // دسترسیِ پنل از روی نقشِ DB (با fallbackِ bootstrap اگر ستون/اتصال نبود).
  let isStaffUser = isBootstrapOwner(session.username);
  try {
    const db = getServiceClient();
    const { data, error } = await db
      .from("users")
      .select("display_name, is_guest, role")
      .eq("id", session.uid)
      .maybeSingle();
    // سشنِ یتیم: JWT معتبر است ولی کاربر دیگر در دیتابیس نیست (مثلاً بعد از مهاجرت).
    // اگر اجازه دهیم رد شود، هر نوشتنی با خطای FK می‌ترکد؛ پس پاکش می‌کنیم و به ورود
    // می‌فرستیم. فقط وقتی قطعاً «پیدا نشد» (data=null و error=null) — نه روی خطای اتصال.
    if (!data && !error) {
      await clearSession();
      redirect("/login");
    }
    if (data?.display_name) displayName = data.display_name;
    isGuest = !!data?.is_guest;
    if (data) isStaffUser = isStaffUser || isStaff(normalizeRole((data as { role?: unknown }).role));
  } catch (e) {
    // redirect() داخلِ Next با throw کار می‌کند؛ نباید بلعیده شود.
    if (e && typeof e === "object" && "digest" in e && String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) {
      throw e;
    }
    // اگر اتصال دیتابیس برقرار نبود، با همان نام کاربری ادامه بده
  }

  // برای مهمان، نامِ نمایشیِ تمیزتر (به‌جای guest_xxxx)
  if (isGuest && displayName === session.username) displayName = "مهمان";

  return (
    <AppChrome username={session.username} displayName={displayName} isAdmin={isStaffUser} isGuest={isGuest}>
      {children}
    </AppChrome>
  );
}
