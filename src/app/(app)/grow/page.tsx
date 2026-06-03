"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Segmented } from "@/components/ui";
import { useApp } from "@/components/AppContext";
import IdentitiesView from "@/components/views/IdentitiesView";
import HabitsView from "@/components/views/HabitsView";
import MissionsView from "@/components/views/MissionsView";
import RewardsView from "@/components/views/RewardsView";

type Seg = "identities" | "habits" | "missions" | "rewards";

const OPTS: { value: Seg; label: string }[] = [
  { value: "habits", label: "عادت‌ها" },
  { value: "identities", label: "هویت‌ها" },
  { value: "missions", label: "ماموریت‌ها" },
  { value: "rewards", label: "جایزه‌ها" },
];

const VALID = new Set<Seg>(["identities", "habits", "missions", "rewards"]);

function GrowInner() {
  const sp = useSearchParams();
  const param = sp.get("seg") as Seg | null;
  const [seg, setSeg] = useState<Seg>(param && VALID.has(param) ? param : "habits");
  const { refreshKey } = useApp();

  return (
    <div className="space-y-4">
      <div className="pt-2">
        <Segmented options={OPTS} value={seg} onChange={setSeg} />
      </div>
      {/* تعویضِ بخش و «ثبتِ سریع» باعثِ بارگذاریِ دوباره‌ی همان ویو می‌شود */}
      <div key={`${seg}-${refreshKey}`}>
        {seg === "habits" && <HabitsView />}
        {seg === "identities" && <IdentitiesView />}
        {seg === "missions" && <MissionsView />}
        {seg === "rewards" && <RewardsView />}
      </div>
    </div>
  );
}

export default function GrowPage() {
  return (
    <Suspense>
      <GrowInner />
    </Suspense>
  );
}
