"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Segmented } from "@/components/ui";
import { useApp } from "@/components/AppContext";
import CaloriesView from "@/components/views/CaloriesView";
import HealthView from "@/components/views/HealthView";

type Seg = "calorie" | "body";

const OPTS: { value: Seg; label: string }[] = [
  { value: "calorie", label: "کالری" },
  { value: "body", label: "بدن و آب" },
];

const VALID = new Set<Seg>(["calorie", "body"]);

function HealthInner() {
  const sp = useSearchParams();
  const param = sp.get("seg") as Seg | null;
  const [seg, setSeg] = useState<Seg>(param && VALID.has(param) ? param : "calorie");
  const { profile, reloadProfile, refreshKey } = useApp();

  return (
    <div className="space-y-4">
      <div className="pt-2">
        <Segmented options={OPTS} value={seg} onChange={setSeg} />
      </div>
      <div key={`${seg}-${refreshKey}`}>
        {seg === "calorie" && <CaloriesView profile={profile} onProfileChange={reloadProfile} />}
        {seg === "body" && <HealthView profile={profile} />}
      </div>
    </div>
  );
}

export default function HealthPage() {
  return (
    <Suspense>
      <HealthInner />
    </Suspense>
  );
}
