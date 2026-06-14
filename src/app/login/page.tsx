"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiSend } from "@/lib/client";
import { Spinner } from "@/components/ui";
import { AppIcon } from "@/components/AppIcon";
import { Mascot } from "@/components/Mascot";
import { KeyRound, User, UserPlus, LogIn, Download, Share, Plus, X } from "lucide-react";

const APP = process.env.NEXT_PUBLIC_APP_NAME || "امروز";
const TAGLINE = "همین امروز";
const ONBOARD_KEY = "zendegi:onboarded";

type Screen = "splash" | "onboarding" | "login" | "signup";

// هر اسلاید یک ته‌رنگِ پاستلی + اکسنت از پالتِ جدید (آبی/هلویی/سبز/یاسی) دارد.
const SLIDES: { icon: string; title: string; desc: string; tint: string; accent: string; mascot?: boolean }[] = [
  {
    icon: "chart",
    title: "از فردا، نه. از همین امروز.",
    desc: "جوانه کنارته تا از «می‌دونم باید» برسی به «انجامش دادم».",
    tint: "var(--t-sage)",
    accent: "var(--sage)",
    mascot: true,
  },
  {
    icon: "rocket",
    title: "هدفت رو بگو، می‌شکنمش.",
    desc: "بزرگ‌ترین هدفت رو می‌گیرم و خُردش می‌کنم به قدم‌های امروز — اون‌قدر کوچیک که نشه نه گفت.",
    tint: "var(--t-blue)",
    accent: "var(--blue)",
  },
  {
    icon: "compass",
    title: "صبح یادآور، شب مرور.",
    desc: "کالری، آب، خرج، تمرین — همه یک‌جا، بی‌شلوغی. تو فقط زندگی کن.",
    tint: "var(--t-lav)",
    accent: "var(--lav)",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    // مستقیم به اسلایدهای معرفی؛ اگر قبلاً دیده، به صفحهٔ ورود.
    let onboarded = false;
    try { onboarded = localStorage.getItem(ONBOARD_KEY) === "1"; } catch { /* noop */ }
    setScreen(onboarded ? "login" : "onboarding");
  }, []);

  function goFromSplash() {
    let onboarded = false;
    try { onboarded = localStorage.getItem(ONBOARD_KEY) === "1"; } catch { /* noop */ }
    setScreen(onboarded ? "login" : "onboarding");
  }

  function finishOnboarding() {
    try { localStorage.setItem(ONBOARD_KEY, "1"); } catch { /* noop */ }
    setErr("");
    setScreen("login");
  }

  function switchTo(next: Screen) {
    setErr("");
    setPassword("");
    setPassword2("");
    setScreen(next);
  }

  // «اول بچش» — ورودِ مهمان بدونِ حساب؛ نام کاربری/رمز بعداً موقعِ ثبت‌نام گرفته می‌شود.
  async function startGuest() {
    try { localStorage.setItem(ONBOARD_KEY, "1"); } catch { /* noop */ }
    setErr("");
    setBusy(true);
    try {
      await apiSend("/api/auth/guest", "POST");
      // مستقیم به لحظه‌ی آها: گفتگو با جوانه باز می‌شود.
      router.replace("/coach?chat=1");
      router.refresh();
    } catch (e: any) {
      setErr(humanize(e?.message));
      setBusy(false);
    }
  }

  // ورود با نام کاربری + رمز عبور.
  async function login() {
    setErr("");
    if (!username.trim() || !password.trim()) return setErr("نام کاربری و رمز عبور را وارد کن.");
    setBusy(true);
    try {
      await apiSend("/api/auth/credentials", "POST", { username, password });
      router.replace("/");
      router.refresh();
    } catch (e: any) {
      setErr(humanize(e?.message));
    } finally {
      setBusy(false);
    }
  }

  // ثبت‌نام با نام کاربری + رمز عبور.
  async function signup() {
    setErr("");
    if (!username.trim()) return setErr("یک نام کاربری انتخاب کن.");
    if (password.length < 6) return setErr("رمز باید حداقل ۶ کاراکتر باشد.");
    if (password !== password2) return setErr("رمز و تکرارش یکی نیستند.");
    setBusy(true);
    try {
      await apiSend("/api/auth/signup", "POST", { username, password });
      router.replace("/");
      router.refresh();
    } catch (e: any) {
      setErr(humanize(e?.message));
    } finally {
      setBusy(false);
    }
  }

  if (screen === null) return null;

  if (screen === "splash") {
    return <SplashScreen onContinue={goFromSplash} />;
  }

  if (screen === "onboarding") {
    return <Onboarding onStart={startGuest} onLogin={finishOnboarding} busy={busy} />;
  }

  const isSignup = screen === "signup";

  return (
    <div className="relative flex flex-col min-h-[100dvh] overflow-hidden" dir="rtl">
      {/* بخش بالایی پاستلی با آدمکِ جوانه */}
      <div
        className="flex-none flex flex-col"
        style={{
          height: "38dvh",
          background: isSignup
            ? "linear-gradient(135deg, var(--t-sage) 0%, var(--t-blue) 100%)"
            : "linear-gradient(135deg, var(--t-blue) 0%, var(--t-sage) 100%)",
        }}
      >
        <div className="flex items-center justify-between px-5 pt-[max(16px,env(safe-area-inset-top))] pb-2">
          <button
            onClick={() => setScreen("onboarding")}
            className="h-9 w-9 rounded-full bg-white/70 backdrop-blur-sm flex items-center justify-center text-[var(--ink)] shadow-soft active:scale-90 transition"
            aria-label="برگشت"
          >
            <ChevronRight />
          </button>
          <span className="text-[var(--secondary)] text-[14px] font-medium">
            {isSignup ? "ساختِ حساب" : "خوش برگشتی"}
          </span>
        </div>
        <div className="flex-1 flex items-end justify-center">
          <Mascot size={132} pose={isSignup ? "cheer" : "wave"} float />
        </div>
      </div>

      {/* کارت پایینی سفید */}
      <div
        className="flex-1 flex flex-col rounded-t-[36px] bg-[var(--card-solid)] px-6 pt-7 pb-[max(28px,env(safe-area-inset-bottom))] -mt-5 shadow-[0_-4px_30px_-10px_rgba(30,40,70,0.18)]"
        style={{ minHeight: "62dvh" }}
      >
        <div className="mb-6">
          <h1 className="text-[28px] font-extrabold tracking-tight text-[var(--label)] leading-tight">
            {isSignup ? "یک حساب بساز" : "وارد شو"}
          </h1>
          <p className="text-[15px] text-[var(--secondary)] mt-1">
            {isSignup
              ? "نام کاربری و رمز عبور انتخاب کن — همین برای ورودهای بعدی کافیه."
              : "با نام کاربری و رمز عبورت وارد شو."}
          </p>
        </div>

        <div className="space-y-3 mb-5">
          <div className="relative">
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--secondary)] pointer-events-none">
              <User size={18} />
            </span>
            <input
              className="ios-input w-full pr-10 text-right"
              placeholder="نام کاربری"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (isSignup ? signup() : login())}
              disabled={busy}
              style={{ direction: "ltr", textAlign: "right" }}
            />
          </div>
          <div className="relative">
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--secondary)] pointer-events-none">
              <KeyRound size={18} />
            </span>
            <input
              className="ios-input w-full pr-10 text-right"
              placeholder={isSignup ? "رمز عبور (حداقل ۶ کاراکتر)" : "رمز عبور"}
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (isSignup ? signup() : login())}
              disabled={busy}
            />
          </div>
          {isSignup && (
            <div className="relative">
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--secondary)] pointer-events-none">
                <KeyRound size={18} />
              </span>
              <input
                className="ios-input w-full pr-10 text-right"
                placeholder="تکرار رمز عبور"
                type="password"
                autoComplete="new-password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && signup()}
                disabled={busy}
              />
            </div>
          )}
        </div>

        {err && <p className="text-ios-red text-[13px] text-center mb-3">{err}</p>}

        <PillButton onClick={isSignup ? signup : login} disabled={busy} busy={busy}>
          {isSignup ? <UserPlus size={18} /> : <LogIn size={18} />}
          {isSignup ? "ثبت‌نام و ورود" : "ورود"}
        </PillButton>

        {!isSignup && (
          <p className="text-center text-[12px] leading-5 text-[var(--secondary)] mt-4">
            با ورود، {" "}
            <Link href="/legal" className="text-ios-blue font-medium">قوانین و حریم خصوصی</Link>{" "}
            رو می‌پذیری.
          </p>
        )}

        <button
          className="w-full text-center text-[14px] text-ios-blue font-medium mt-4 active:opacity-60 disabled:opacity-50"
          onClick={() => switchTo(isSignup ? "login" : "signup")}
          disabled={busy}
        >
          {isSignup ? "قبلاً حساب داری؟ ورود" : "حساب نداری؟ ثبت‌نام کن"}
        </button>
      </div>
    </div>
  );
}

function PillButton({
  onClick,
  disabled,
  busy,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full h-14 rounded-full text-white text-[16px] font-bold flex items-center justify-center gap-2.5 active:scale-[0.97] transition disabled:opacity-50"
      style={{ background: "var(--ink)", boxShadow: "0 14px 28px -14px rgba(20,22,30,0.6)" }}
    >
      {busy ? <Spinner /> : children}
    </button>
  );
}

function SplashScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <div
      className="relative min-h-[100dvh] flex flex-col items-center justify-between overflow-hidden px-6 pt-[max(60px,env(safe-area-inset-top))] pb-[max(48px,env(safe-area-inset-bottom))]"
      dir="rtl"
      style={{
        background: "var(--bg)",
        backgroundImage:
          "radial-gradient(120% 70% at 12% -8%, rgba(150,180,230,0.28), transparent 60%), radial-gradient(100% 60% at 100% 4%, rgba(120,200,190,0.18), transparent 55%)",
      }}
    >
      {/* هاله‌های نرمِ پاستلی */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-16 -right-16 h-64 w-64 rounded-full blur-3xl opacity-50 animate-float" style={{ background: "var(--t-blue)" }} />
        <div className="absolute bottom-24 -left-16 h-56 w-56 rounded-full blur-3xl opacity-50 animate-float" style={{ background: "var(--t-sage)", animationDelay: "-3s" }} />
      </div>

      {/* محتوای مرکزی — آدمکِ جوانه */}
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <Mascot size={188} pose="wave" float />
        <h1 className="t-display text-[44px] mt-6">{APP}</h1>
        <p className="secondary text-[17px] mt-2 font-medium tracking-wide">{TAGLINE}</p>
      </div>

      {/* پیشنهادِ نصب اپ روی صفحهٔ خانه (PWA) */}
      <PwaInstallHint />

      {/* دکمه ادامه — قرصِ مشکیِ امضایی */}
      <button
        onClick={onContinue}
        className="h-14 w-14 rounded-full flex items-center justify-center text-white active:scale-90 transition"
        style={{ background: "var(--ink)", boxShadow: "0 14px 28px -14px rgba(20,22,30,0.6)" }}
        aria-label="ادامه"
      >
        <ChevronDown />
      </button>
    </div>
  );
}

function Onboarding({ onStart, onLogin, busy }: { onStart: () => void; onLogin: () => void; busy?: boolean }) {
  const [i, setI] = useState(0);
  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;

  return (
    <div className="relative min-h-[100dvh] flex flex-col overflow-hidden px-6 pt-[max(18px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))]" dir="rtl">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -right-16 h-64 w-64 rounded-full blur-3xl opacity-60 animate-float" style={{ background: s.tint }} />
        <div className="absolute -bottom-24 right-1/4 h-64 w-64 rounded-full blur-3xl opacity-40 animate-float" style={{ background: s.tint, animationDelay: "-4s" }} />
      </div>

      <div className="relative z-10 flex items-center justify-between h-10">
        {i > 0 ? (
          <button
            onClick={() => setI(i - 1)}
            aria-label="قبلی"
            className="h-10 w-10 -mr-1 rounded-full glass border border-[var(--border)] flex items-center justify-center text-[var(--secondary)] active:scale-90 transition"
          >
            <ChevronRight />
          </button>
        ) : (
          <span className="w-10" />
        )}
        <button onClick={onStart} className="secondary text-[15px] font-semibold active:opacity-60">
          رد کردن
        </button>
      </div>

      <div key={i} className="relative z-10 flex-1 flex flex-col items-center justify-center text-center animate-fade-up">
        <div className="relative mb-10 grid place-items-center">
          <div className="absolute h-56 w-56 rounded-full blur-3xl opacity-70" style={{ background: s.tint }} />
          {s.mascot ? (
            <Mascot size={176} pose="cheer" float />
          ) : (
            <div
              className="relative h-40 w-40 rounded-[46px] flex items-center justify-center animate-float"
              style={{
                background: s.tint,
                color: s.accent,
                boxShadow: "var(--sh)",
              }}
            >
              <AppIcon name={s.icon} size={68} strokeWidth={1.6} />
            </div>
          )}
        </div>
        <h2 className="t-h1 text-[30px] px-2">{s.title}</h2>
        <p className="secondary text-[16px] leading-8 mt-3 max-w-xs">{s.desc}</p>
      </div>

      <div className="relative z-10 space-y-5">
        <div className="flex items-center justify-center gap-2">
          {SLIDES.map((_, idx) => (
            <span
              key={idx}
              className={`h-2 rounded-full transition-all duration-300 ${idx === i ? "w-7 bg-ios-blue" : "w-2 bg-[var(--secondary)]/45"}`}
            />
          ))}
        </div>
        <button
          onClick={last ? onStart : () => setI(i + 1)}
          disabled={busy}
          className="w-full h-14 rounded-full text-white text-[16px] font-bold flex items-center justify-center gap-2.5 active:scale-[0.97] transition disabled:opacity-60"
          style={{
            background: "var(--ink)",
            boxShadow: "0 14px 28px -14px rgba(20,22,30,0.6)",
          }}
        >
          {busy ? (
            <Spinner />
          ) : last ? (
            <>بزن بریم، رایگان امتحان کن <AppIcon name="rocket" size={19} /></>
          ) : (
            <>بعدی <ChevronLeft /></>
          )}
        </button>
        <button onClick={onLogin} disabled={busy} className="w-full text-center text-ios-blue text-[15px] font-medium active:opacity-60 disabled:opacity-50">
          قبلاً حساب دارم؟ ورود
        </button>
      </div>
    </div>
  );
}

const PWA_HINT_KEY = "zendegi:pwa-hint-dismissed";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function PwaInstallHint() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [showIOSSheet, setShowIOSSheet] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // اگر از قبل به‌صورت اپ باز شده، چیزی نشان نده.
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setStandalone(!!isStandalone);

    const ua = window.navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) && !(window as any).MSStream;
    setIsIOS(ios);

    let alreadyDismissed = false;
    try { alreadyDismissed = localStorage.getItem(PWA_HINT_KEY) === "1"; } catch { /* noop */ }
    setDismissed(alreadyDismissed);

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  function close() {
    setDismissed(true);
    try { localStorage.setItem(PWA_HINT_KEY, "1"); } catch { /* noop */ }
  }

  async function install() {
    if (deferred) {
      await deferred.prompt();
      try { await deferred.userChoice; } catch { /* noop */ }
      setDeferred(null);
      close();
    } else if (isIOS) {
      setShowIOSSheet(true);
    }
  }

  // فقط وقتی نشان بده که قابل‌نصب است و قبلاً رد نشده و داخلِ اپ نیست.
  const canShow = !standalone && !dismissed && (!!deferred || isIOS);
  if (!canShow) return null;

  return (
    <>
      <div
        className="relative z-10 w-full max-w-sm mb-5 rounded-3xl px-4 py-3.5 flex items-center gap-3 glass border border-[var(--border)] animate-fade-up"
        style={{ boxShadow: "var(--sh)" }}
      >
        <div
          className="h-11 w-11 rounded-2xl flex-none flex items-center justify-center"
          style={{ background: "var(--t-blue)", color: "var(--blue)" }}
        >
          <Download size={20} strokeWidth={2.1} />
        </div>
        <div className="flex-1 text-right">
          <p className="text-[14px] font-bold text-[var(--label)] leading-tight">{APP} را نصب کن</p>
          <p className="text-[12px] text-[var(--secondary)] mt-0.5 leading-snug">
            بدون مرورگر، سریع و تمام‌صفحه — مثل یک اپ واقعی روی گوشی‌ات.
          </p>
        </div>
        <button
          onClick={install}
          className="flex-none h-9 px-4 rounded-full text-white text-[13px] font-bold active:scale-95 transition"
          style={{ background: "var(--ink)" }}
        >
          نصب
        </button>
        <button
          onClick={close}
          aria-label="بستن"
          className="flex-none h-7 w-7 -mr-1 rounded-full flex items-center justify-center text-[var(--secondary)] active:opacity-60"
        >
          <X size={16} />
        </button>
      </div>

      {showIOSSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm animate-fade-up"
          onClick={() => setShowIOSSheet(false)}
        >
          <div
            className="w-full max-w-md rounded-t-[32px] bg-[var(--card-solid)] px-6 pt-6 pb-[max(28px,env(safe-area-inset-bottom))]"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[20px] font-extrabold text-[var(--label)]">نصب روی آیفون</h3>
              <button
                onClick={() => setShowIOSSheet(false)}
                aria-label="بستن"
                className="h-8 w-8 rounded-full bg-[var(--bg)] flex items-center justify-center text-[var(--secondary)] active:scale-90 transition"
              >
                <X size={18} />
              </button>
            </div>
            <ol className="space-y-4">
              <li className="flex items-center gap-3">
                <span className="h-9 w-9 rounded-2xl flex-none flex items-center justify-center text-[var(--blue)]" style={{ background: "var(--t-blue)" }}>
                  <Share size={18} />
                </span>
                <p className="text-[15px] text-[var(--label)]">روی دکمهٔ <b>اشتراک‌گذاری</b> در نوار سافاری بزن.</p>
              </li>
              <li className="flex items-center gap-3">
                <span className="h-9 w-9 rounded-2xl flex-none flex items-center justify-center text-[var(--sage)]" style={{ background: "var(--t-sage)" }}>
                  <Plus size={18} />
                </span>
                <p className="text-[15px] text-[var(--label)]">گزینهٔ <b>«افزودن به صفحهٔ خانه»</b> را انتخاب کن.</p>
              </li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
}

function ChevronDown() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function ChevronLeft() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function humanize(msg?: string): string {
  if (!msg) return "خطایی رخ داد. دوباره تلاش کن.";
  return msg;
}
