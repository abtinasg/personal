"use client";

import { useRouter } from "next/navigation";
import DashboardView from "@/components/views/DashboardView";
import { useApp } from "@/components/AppContext";
import { hrefForTab } from "@/lib/nav";

export default function HomePage() {
  const router = useRouter();
  const { profile, refreshKey } = useApp();
  // key با refreshKey: بعد از «ثبتِ سریع» داشبورد داده‌اش را تازه می‌کند، اما با جابه‌جاییِ تب نه.
  return <DashboardView key={refreshKey} profile={profile} onGoto={(t) => router.push(hrefForTab(t))} />;
}
