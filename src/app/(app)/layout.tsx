import { redirect } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
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
  try {
    const db = getServiceClient();
    const { data } = await db
      .from("users")
      .select("display_name, is_guest")
      .eq("id", session.uid)
      .maybeSingle();
    if (data?.display_name) displayName = data.display_name;
    isGuest = !!data?.is_guest;
  } catch {
    // اگر اتصال دیتابیس برقرار نبود، با همان نام کاربری ادامه بده
  }

  // برای مهمان، نامِ نمایشیِ تمیزتر (به‌جای guest_xxxx)
  if (isGuest && displayName === session.username) displayName = "مهمان";

  return (
    <AppChrome username={session.username} displayName={displayName} isAdmin={isAdmin(session)} isGuest={isGuest}>
      {children}
    </AppChrome>
  );
}
