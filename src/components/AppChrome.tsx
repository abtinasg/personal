"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { apiGet, apiSend } from "@/lib/client";
import { jDate, parseNum, groupFa } from "@/lib/format";
import type { Profile } from "@/lib/types";
import { Icon } from "@/components/icons";
import { Sheet, Field, MoneyInput, Button, Spinner, Chevron } from "@/components/ui";
import { AppProvider } from "@/components/AppContext";
import QuickCapture from "@/components/QuickCapture";
import Onboarding from "@/components/Onboarding";

/** تب‌های اصلی (مسیرهای واقعیِ روتر). دکمه‌ی وسط «ثبتِ سریع» است و مسیر ندارد. */
const NAV: { href: string; label: string; icon: string }[] = [
  { href: "/", label: "خانه", icon: "home" },
  { href: "/grow", label: "رشد", icon: "grow" },
  { href: "/health", label: "سلامت", icon: "health" },
  { href: "/budget", label: "سرمایه", icon: "budget" },
  { href: "/coach", label: "مربی", icon: "coach" },
];

/** عنوانِ هدر برای مسیرهایی که تیتر می‌خواهند (به‌جای سلامِ داشبورد). */
const TITLES: Record<string, string> = {
  "/grow": "رشد",
  "/health": "سلامت",
  "/coach": "مربی",
  "/budget": "سرمایه و خرج",
};

/** مسیرهایی که تب نیستند و باید شِورانِ بازگشت نشان دهند. */
const SUB_ROUTES = new Set<string>([]);

export default function AppChrome({
  username,
  displayName,
  isAdmin = false,
  children,
}: {
  username: string;
  displayName: string;
  isAdmin?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  const isHome = pathname === "/";
  const isSub = SUB_ROUTES.has(pathname);
  const title = TITLES[pathname];

  // کاربرِ تازه‌وارد هنوز مشخصاتِ پایه را نداده — تا تمام‌شدنِ انبوردینگ، اپ را پشتِ آن نشان نده.
  const needsOnboarding = profile != null && !profile.onboarded;

  return (
    <AppProvider value={{ profile, reloadProfile: loadProfile, refreshKey, username, displayName }}>
      {needsOnboarding && (
        <Onboarding
          initialName={displayName === username ? "" : displayName}
          onDone={() => {
            loadProfile();
            router.refresh();
          }}
        />
      )}
      <div className="min-h-[100dvh] mx-auto max-w-md pb-28">
        {/* هدر */}
        <header className="sticky top-0 z-30 glass px-5 pt-[max(14px,env(safe-area-inset-top))] pb-3">
          <div className="flex items-center justify-between gap-3">
            {isSub ? (
              <button
                onClick={() => router.back()}
                className="flex items-center gap-1.5 -mr-1 text-ios-blue active:opacity-60 transition"
                aria-label="بازگشت"
              >
                <Chevron dir="back" size={26} />
                <h1 className="text-[24px] font-extrabold tracking-tight leading-tight">{title}</h1>
              </button>
            ) : isHome ? (
              <div className="min-w-0">
                <p className="secondary text-[13px]">{jDate(new Date())}</p>
                <h1 className="text-[26px] font-extrabold tracking-tight leading-tight truncate">
                  {greeting}، {displayName}
                </h1>
              </div>
            ) : (
              <h1 className="text-[26px] font-extrabold tracking-tight leading-tight">{title}</h1>
            )}

            <button
              onClick={() => setSettingsOpen(true)}
              aria-label="تنظیمات و حساب"
              className="h-11 w-11 shrink-0 rounded-full bg-gradient-to-br from-[var(--blue)] to-[var(--lav)] text-white font-bold text-[18px] flex items-center justify-center shadow-card active:scale-95 transition"
            >
              {(displayName[0] || "؟").toUpperCase()}
            </button>
          </div>
        </header>

        {/* محتوای صفحه — با تغییرِ مسیر، fade-up دوباره اجرا می‌شود */}
        <main key={pathname} className="px-5 animate-fade-up">
          {children}
        </main>

        {/* تب‌بار پایین با دکمه‌ی مرکزیِ «ثبتِ سریع» */}
        <nav className="fixed bottom-0 inset-x-0 z-40">
          <div className="mx-auto max-w-md px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
            <div className="glass-strong flex items-center justify-around rounded-[30px] shadow-float border border-[var(--border)] py-2 px-1.5">
              {NAV.slice(0, 2).map((t) => (
                <NavTab key={t.href} {...t} pathname={pathname} />
              ))}

              <button
                onClick={() => setCaptureOpen(true)}
                aria-label="ثبتِ سریع"
                className="-mt-7 h-14 w-14 shrink-0 rounded-full bg-[var(--ink)] text-white flex items-center justify-center shadow-glow active:scale-90 transition border-4 border-[var(--bg)]"
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>

              {NAV.slice(2).map((t) => (
                <NavTab key={t.href} {...t} pathname={pathname} />
              ))}
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

        <SettingsSheet
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          profile={profile}
          username={username}
          displayName={displayName}
          isAdmin={isAdmin}
          onSaved={loadProfile}
          onLogout={async () => {
            await apiSend("/api/auth/logout", "POST");
            router.replace("/login");
            router.refresh();
          }}
        />
      </div>
    </AppProvider>
  );
}

function NavTab({ href, label, icon, pathname }: { href: string; label: string; icon: string; pathname: string }) {
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-[18px] transition ${
        active ? "text-ios-blue bg-ios-blue/10" : "text-[var(--secondary)]"
      }`}
    >
      <Icon name={icon} active={active} />
      <span className={`text-[11px] ${active ? "font-bold" : "font-medium"}`}>{label}</span>
    </Link>
  );
}

function SettingsSheet({
  open,
  onClose,
  profile,
  username,
  displayName,
  isAdmin = false,
  onSaved,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  profile: Profile | null;
  username: string;
  displayName: string;
  isAdmin?: boolean;
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
      setBudget(profile.monthly_budget ? groupFa(String(profile.monthly_budget)) : "");
      setWater(String(profile.water_goal_ml || ""));
      setWeight(profile.weight_goal ? String(profile.weight_goal) : "");
    }
  }, [profile, open]);

  async function save() {
    setSaving(true);
    try {
      await apiSend("/api/profile", "PUT", {
        daily_calorie_goal: parseNum(cal) || 0,
        monthly_budget: parseNum(budget) || 0,
        water_goal_ml: parseNum(water) || 0,
        weight_goal: weight ? parseNum(weight) : null,
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
        <div className="h-14 w-14 rounded-full bg-gradient-to-br from-[var(--blue)] to-[var(--lav)] text-white font-bold text-[22px] flex items-center justify-center">
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
          <MoneyInput value={budget} onChange={setBudget} placeholder="۱۰٬۰۰۰٬۰۰۰" />
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
      <a
        href="/wallet"
        onClick={onClose}
        className="mt-3 flex w-full items-center justify-between rounded-2xl bg-[var(--label)]/[0.05] px-4 py-3.5 text-[16px] font-semibold active:opacity-60"
      >
        <span>کیف پول و اعتبار</span>
        <Chevron dir="forward" size={20} className="secondary" />
      </a>
      {isAdmin && (
        <a
          href="/admin"
          onClick={onClose}
          className="mt-3 flex w-full items-center justify-between rounded-2xl bg-[var(--label)]/[0.05] px-4 py-3.5 text-[16px] font-semibold active:opacity-60"
        >
          <span>پنل مدیریت</span>
          <Chevron dir="forward" size={20} className="secondary" />
        </a>
      )}
      <button
        onClick={onLogout}
        className="w-full mt-3 py-3 text-ios-red font-semibold text-[17px] active:opacity-60"
      >
        خروج از حساب
      </button>
    </Sheet>
  );
}
