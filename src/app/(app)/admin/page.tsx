import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { resolveRole } from "@/lib/access";
import { isStaff } from "@/lib/roles";
import AdminView from "@/components/views/AdminView";

export const dynamic = "force-dynamic";

/**
 * پنل مدیریت — فقط برای اعضای تیم (support به بالا). نقش از دیتابیس خوانده می‌شود
 * (RBAC)، نه از ENV. owner اولیه با ADMIN_USERNAME بوت‌استرپ می‌شود.
 */
export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const role = await resolveRole(getServiceClient(), session.uid, session.username);
  if (!role || !isStaff(role)) redirect("/");
  return <AdminView />;
}
