"use client";

import BudgetView from "@/components/views/BudgetView";
import { useApp } from "@/components/AppContext";

export default function BudgetPage() {
  const { profile, refreshKey } = useApp();
  return <BudgetView key={refreshKey} profile={profile} />;
}
