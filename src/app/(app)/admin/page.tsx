import { redirect } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import AdminView from "@/components/views/AdminView";

export const dynamic = "force-dynamic";

/** پنل مدیریت — فقط برای کاربرِ ادمین (ADMIN_USERNAME). بقیه به خانه ریدایرکت می‌شوند. */
export default async function AdminPage() {
  const session = await getSession();
  if (!isAdmin(session)) redirect("/");
  return <AdminView />;
}
