"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiSend } from "@/lib/client";
import { jDate } from "@/lib/format";
import type { Profile, Tab } from "@/lib/types";
import { Icon } from "@/components/icons";
import { AppIcon } from "@/components/AppIcon";
import { Sheet, Field, Button, Spinner } from "@/components/ui";
import DashboardView from "@/components/views/DashboardView";
import CaloriesView from "@/components/views/CaloriesView";
import BudgetView from "@/components/views/BudgetView";
import HealthView from "@/components/views/HealthView";
import HabitsView from "@/components/views/HabitsView";
import MissionsView from "@/components/views/MissionsView";
import IdentitiesView from "@/components/views/IdentitiesView";
import RewardsView from "@/components/views/RewardsView";
import WorkoutView from "@/components/views/WorkoutView";
import MoreView from "@/components/views/MoreView";
import CoachChat from "@/components/CoachChat";
import QuickCapture from "@/components/QuickCapture";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "home", label: "خانه", icon: "home" },
  { key: "missions", label: "ماموریت", icon: "missions" },
  { key: "habit", label: "عادت‌ها", icon: "habit" },
  { key: "health", label: "سلامتی", icon: "health" },
  { key: "more", label: "بیشتر", icon: "more" },
];

// زیرصفحه‌های داخل «بیشتر»
const SUB_TITLES: Partial<Record<Tab, string>> = {
  calorie: "کالری‌شمار",
  budget: "بودجه و خرج",
  identities: "هویت‌ها",
  rewards: "جایزه‌ها",
  workout: "برنامه‌ی ورزشی",
};

export default function AppShell({
  username,
  displayName,
}: {
  username: string;
  displayName: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("home");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadProfile = useCallback(async () => {
    try {
      const { profile } = await apiGet<{ profile: Profile }>("/api/profile");
      setProfile(profile);
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const hour = new Date().getHours();
  const greeting = hour < 5 ? "شب‌بخیر" : hour < 12 ? "صبح‌بخیر" : hour < 18 ? "ظهرت بخیر" : "عصرت بخیر";
  const subTitle = SUB_TITLES[tab];

  return (
    <div className="min-h-[100dvh] mx-auto max-w-md pb-28">
      {/* هدر */}
      <header className="sticky top-0 z-30 glass px-5 pt-[max(14px,env(safe-area-inset-top))] pb-3">
        <div className="flex items-center justify-between gap-3">
          {subTitle ? (
            <button onClick={() => setTab("more")} className="flex items-center gap-1.5 -mr-1 active:opacity-60 transition">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--ios-blue,#5b76f0)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-ios-blue">
                <path d="m9 18 6-6-6-6" />
              </svg>
              <h1 className="text-[24px] font-extrabold tracking-tight leading-tight">{subTitle}</h1>
            </button>
          ) : (
            <div className="min-w-0">
              <p className="secondary text-[13px]">{jDate(new Date())}</p>
              <h1 className="text-[26px] font-extrabold tracking-tight leading-tight truncate">
                {greeting}، {displayName}
              </h1>
            </div>
          )}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setCaptureOpen(true)}
              aria-label="ثبت سریع"
              className="h-11 w-11 rounded-full glass border border-[var(--border)] flex items-center justify-center text-ios-blue shadow-card active:scale-95 transition"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
            <button
              onClick={() => setCoachOpen(true)}
              aria-label="مربی"
              className="h-11 w-11 rounded-full glass border border-[var(--border)] flex items-center justify-center text-ios-blue shadow-card active:scale-95 transition"
            >
              <AppIcon name="compass" size={23} />
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="h-11 w-11 rounded-full bg-gradient-to-br from-ios-blue to-ios-indigo text-white font-bold text-[18px] flex items-center justify-center shadow-card active:scale-95 transition"
            >
              {(displayName[0] || "؟").toUpperCase()}
            </button>
          </div>
        </div>
      </header>

      <main className="px-5 animate-fade-up" key={`${tab}-${refreshKey}`}>
        {tab === "home" && <DashboardView profile={profile} onGoto={setTab} />}
        {tab === "missions" && <MissionsView />}
        {tab === "habit" && <HabitsView />}
        {tab === "health" && <HealthView profile={profile} />}
        {tab === "more" && <MoreView onGoto={setTab} />}
        {tab === "identities" && <IdentitiesView />}
        {tab === "rewards" && <RewardsView />}
        {tab === "calorie" && <CaloriesView profile={profile} onProfileChange={loadProfile} />}
        {tab === "budget" && <BudgetView profile={profile} />}
        {tab === "workout" && <WorkoutView />}
      </main>

      {/* تب‌بار پایین */}
      <nav className="fixed bottom-0 inset-x-0 z-40">
        <div className="mx-auto max-w-md px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <div className="glass-strong flex items-center justify-around rounded-[30px] shadow-float border border-[var(--border)] py-2 px-1.5">
            {TABS.map((t) => {
              const active = tab === t.key || (t.key === "more" && subTitle != null);
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-[18px] transition ${
                    active ? "text-ios-blue bg-ios-blue/10" : "text-[var(--secondary)]"
                  }`}
                >
                  <Icon name={t.icon} active={active} />
                  <span className={`text-[10px] ${active ? "font-bold" : "font-medium"}`}>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <QuickCapture
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        onSaved={() => {
          loadProfile();
          setRefreshKey((k) => k + 1);
        }}
      />

      <CoachChat open={coachOpen} onClose={() => setCoachOpen(false)} />

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        profile={profile}
        username={username}
        displayName={displayName}
        onSaved={loadProfile}
        onLogout={async () => {
          await apiSend("/api/auth/logout", "POST");
          router.replace("/login");
          router.refresh();
        }}
      />
    </div>
  );
}

function SettingsSheet({
  open,
  onClose,
  profile,
  username,
  displayName,
  onSaved,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  profile: Profile | null;
  username: string;
  displayName: string;
  onSaved: () => void;
  onLogout: () => void;
}) {
  const [cal, setCal] = useState("");
  const [budget, setBudget] = useState("");
  const [water, setWater] = useState("");
  const [weight, setWeight] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setCal(String(profile.daily_calorie_goal || ""));
      setBudget(String(profile.monthly_budget || ""));
      setWater(String(profile.water_goal_ml || ""));
      setWeight(profile.weight_goal ? String(profile.weight_goal) : "");
    }
  }, [profile, open]);

  async function save() {
    setSaving(true);
    try {
      await apiSend("/api/profile", "PUT", {
        daily_calorie_goal: Number(cal) || 0,
        monthly_budget: Number(budget) || 0,
        water_goal_ml: Number(water) || 0,
        weight_goal: weight ? Number(weight) : null,
      });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="تنظیمات و اهداف">
      <div className="flex items-center gap-3 mb-5 mt-1">
        <div className="h-14 w-14 rounded-full bg-gradient-to-br from-ios-blue to-ios-indigo text-white font-bold text-[22px] flex items-center justify-center">
          {(displayName[0] || "؟").toUpperCase()}
        </div>
        <div>
          <p className="text-[18px] font-bold">{displayName}</p>
          <p className="secondary text-[14px]" dir="ltr">@{username}</p>
        </div>
      </div>

      <div className="space-y-3">
        <Field label="هدف کالری روزانه">
          <input className="ios-input" inputMode="numeric" value={cal} onChange={(e) => setCal(e.target.value)} placeholder="۲۰۰۰" />
        </Field>
        <Field label="بودجه‌ی ماهانه (تومان)">
          <input className="ios-input" inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="۱۰٬۰۰۰٬۰۰۰" />
        </Field>
        <Field label="هدف آب روزانه (میلی‌لیتر)">
          <input className="ios-input" inputMode="numeric" value={water} onChange={(e) => setWater(e.target.value)} placeholder="۲۰۰۰" />
        </Field>
        <Field label="وزن هدف (کیلوگرم)">
          <input className="ios-input" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="اختیاری" />
        </Field>
      </div>

      <Button onClick={save} disabled={saving} className="w-full mt-5 flex items-center justify-center gap-2">
        {saving && <Spinner />} ذخیره
      </Button>
      <button
        onClick={onLogout}
        className="w-full mt-3 py-3 text-ios-red font-semibold text-[17px] active:opacity-60"
      >
        خروج از حساب
      </button>
    </Sheet>
  );
}
