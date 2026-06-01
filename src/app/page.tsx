import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");

  let displayName = session.username;
  try {
    const db = getServiceClient();
    const { data } = await db
      .from("users")
      .select("display_name")
      .eq("id", session.uid)
      .maybeSingle();
    if (data?.display_name) displayName = data.display_name;
  } catch {
    // اگر اتصال دیتابیس برقرار نبود، با همان نام کاربری ادامه بده
  }

  return <AppShell username={session.username} displayName={displayName} />;
}
