"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser";
import { apiSend } from "@/lib/client";
import { Spinner } from "@/components/ui";
import { Logo } from "@/components/icons";
import { AppIcon } from "@/components/AppIcon";
import { Eye, EyeOff, KeyRound, Lock, User } from "lucide-react";

const APP = process.env.NEXT_PUBLIC_APP_NAME || "یک‌درصد";
const TAGLINE = "هر روز یک‌درصد بهتر";
const ONBOARD_KEY = "zendegi:onboarded";

type Screen = "splash" | "onboarding" | "auth";
type AuthMethod = "passkey" | "password";

const SLIDES: { icon: string; title: string; desc: string; grad: [string, string] }[] = [
  {
    icon: "chart",
    title: "به یک‌درصد خوش اومدی",
    desc: "هر روز فقط یک‌درصد بهتر. همین رأیِ کوچکِ روزانه، در یک سال تو را ۳۷ برابر می‌کند.",
    grad: ["#f5956b", "#f5b87a"],
  },
  {
    icon: "rocket",
    title: "هدف‌هایت را زنده کن",
    desc: "ماموریت بساز و آن را به عادت‌های اتمیِ روزانه بشکن؛ پیشرفتت را با حلقه‌ها زنده ببین.",
    grad: ["#fb9a5b", "#e8724a"],
  },
  {
    icon: "flame",
    title: "همه‌چیز، یک‌جا",
    desc: "کالری، بودجه، آب و سلامتی — با ثبتِ سریع و هوشمند، بی‌شلوغی و آرام.",
    grad: ["#f5c451", "#fb9a5b"],
  },
  {
    icon: "compass",
    title: "مربیِ همیشه‌همراه",
    desc: "یک مربیِ هوشمند کنارت است و ورودت بی‌رمز و امن، فقط با پسکی انجام می‌شود.",
    grad: ["#e8724a", "#d4572d"],
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>("splash");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [authMethod, setAuthMethod] = useState<AuthMethod>("passkey");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(browserSupportsWebAuthn());
    let onboarded = false;
    try {
      onboarded = localStorage.getItem(ONBOARD_KEY) === "1";
    } catch {
      /* نون */
    }
    setMode(onboarded ? "login" : "register");
    // Start at splash always, let user tap down arrow
    setScreen("splash");
    // Store whether they've onboarded for the down arrow destination
    if (!onboarded) {
      // Will go to onboarding
    }
  }, []);

  function goFromSplash() {
    let onboarded = false;
    try { onboarded = localStorage.getItem(ONBOARD_KEY) === "1"; } catch { /* noop */ }
    if (onboarded) {
      setMode("login");
      setScreen("auth");
    } else {
      setScreen("onboarding");
    }
  }

  function finishOnboarding(next: "login" | "register") {
    try { localStorage.setItem(ONBOARD_KEY, "1"); } catch { /* noop */ }
    setErr("");
    setMode(next);
    setScreen("auth");
  }

  async function registerWithPassword() {
    setErr("");
    if (username.trim().length < 2) return setErr("یک نام کاربری حداقل ۲ حرفی بنویس.");
    if (password.length < 6) return setErr("رمز عبور باید حداقل ۶ کاراکتر باشد.");
    setBusy(true);
    try {
      await apiSend("/api/auth/register/password", "POST", { username, password });
      router.replace("/");
      router.refresh();
    } catch (e: any) {
      setErr(humanize(e?.message));
    } finally {
      setBusy(false);
    }
  }

  async function register() {
    setErr("");
    if (username.trim().length < 2) return setErr("یک نام کاربری حداقل ۲ حرفی بنویس.");
    setBusy(true);
    try {
      const { options, displayName } = await apiSend<any>("/api/auth/register/options", "POST", {
        username,
        displayName: username,
      });
      const attResp = await startRegistration({ optionsJSON: options });
      await apiSend("/api/auth/register/verify", "POST", { response: attResp, displayName });
      router.replace("/");
      router.refresh();
    } catch (e: any) {
      setErr(humanize(e?.message));
    } finally {
      setBusy(false);
    }
  }

  async function loginWithPassword() {
    setErr("");
    if (!username.trim()) return setErr("نام کاربری را وارد کن.");
    if (!password) return setErr("رمز عبور را وارد کن.");
    setBusy(true);
    try {
      await apiSend("/api/auth/login/password", "POST", { username, password });
      router.replace("/");
      router.refresh();
    } catch (e: any) {
      setErr(humanize(e?.message));
    } finally {
      setBusy(false);
    }
  }

  async function login() {
    setErr("");
    setBusy(true);
    try {
      const { options } = await apiSend<any>("/api/auth/login/options", "POST", {
        username: username.trim() || undefined,
      });
      const authResp = await startAuthentication({ optionsJSON: options });
      await apiSend("/api/auth/login/verify", "POST", { response: authResp });
      router.replace("/");
      router.refresh();
    } catch (e: any) {
      setErr(humanize(e?.message));
    } finally {
      setBusy(false);
    }
  }

  if (screen === "splash") {
    return <SplashScreen onContinue={goFromSplash} />;
  }

  if (screen === "onboarding") {
    return (
      <Onboarding
        onStart={() => finishOnboarding("register")}
        onLogin={() => finishOnboarding("login")}
      />
    );
  }

  const isLogin = mode === "login";

  function handleSubmit() {
    if (authMethod === "password") {
      return isLogin ? loginWithPassword() : registerWithPassword();
    }
    return isLogin ? login() : register();
  }

  return (
    <div className="relative flex flex-col min-h-[100dvh] overflow-hidden" dir="rtl">
      {/* بخش بالایی رنگی */}
      <div
        className="flex-none flex flex-col"
        style={{
          height: "38dvh",
          background: "linear-gradient(135deg, #f5956b 0%, #e8724a 55%, #d4572d 100%)",
        }}
      >
        {/* نوار بالا */}
        <div className="flex items-center justify-between px-5 pt-[max(16px,env(safe-area-inset-top))] pb-2">
          <button
            onClick={() => setScreen("onboarding")}
            className="h-9 w-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white active:scale-90 transition"
            aria-label="برگشت"
          >
            <ChevronRight />
          </button>
          <span className="text-white/80 text-[14px] font-medium">نیاز به کمک داری؟</span>
        </div>

        {/* لوگو در بخش رنگی */}
        <div className="flex-1 flex items-center justify-center pb-6">
          <div className="relative">
            <div
              className="absolute inset-0 rounded-full blur-2xl opacity-60"
              style={{ background: "rgba(255,255,255,0.35)" }}
            />
            <div className="relative h-20 w-20 rounded-[24px] bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center animate-float shadow-glow">
              <Logo size={44} color="white" />
            </div>
          </div>
        </div>
      </div>

      {/* کارت پایینی سفید */}
      <div
        className="flex-1 flex flex-col rounded-t-[36px] bg-[var(--card-solid)] px-6 pt-7 pb-[max(28px,env(safe-area-inset-bottom))] -mt-5 shadow-[0_-4px_30px_-6px_rgba(160,80,30,0.15)]"
        style={{ minHeight: "62dvh" }}
      >
        {/* عنوان */}
        <div className="mb-6">
          <h1 className="text-[28px] font-extrabold tracking-tight text-[var(--label)] leading-tight">
            {isLogin ? "خوش برگشتی!" : "بیا شروع کنیم"}
          </h1>
          <p className="text-[15px] text-[var(--secondary)] mt-1">
            {isLogin ? "دوباره خوش اومدی." : "حسابت رو بساز!"}
          </p>
        </div>

        {/* انتخاب روش احراز هویت */}
        <div className="flex items-center gap-3 mb-5">
          <MethodButton
            active={authMethod === "passkey"}
            onClick={() => { setAuthMethod("passkey"); setErr(""); setPassword(""); }}
            disabled={!supported}
            label="پسکی"
          >
            <FingerprintIcon />
          </MethodButton>
          <MethodButton
            active={authMethod === "password"}
            onClick={() => { setAuthMethod("password"); setErr(""); }}
            label="رمز عبور"
          >
            <Lock size={20} />
          </MethodButton>
        </div>

        {/* خط جدا‌کننده */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-[var(--secondary)]/20" />
          <span className="text-[12px] text-[var(--secondary)]">
            {authMethod === "passkey" ? "بدون رمز، فقط بیومتریک" : "با نام کاربری و رمز"}
          </span>
          <div className="flex-1 h-px bg-[var(--secondary)]/20" />
        </div>

        {/* فیلدهای ورودی */}
        <div className="space-y-3 mb-4">
          {/* نام کاربری */}
          <div className="relative">
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--secondary)] pointer-events-none">
              <User size={18} />
            </span>
            <input
              className="ios-input w-full pr-10 text-right"
              placeholder="نام کاربری"
              dir="ltr"
              autoCapitalize="none"
              autoCorrect="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={busy}
              style={{ textAlign: "right", direction: "rtl" }}
            />
          </div>

          {/* رمز عبور */}
          {authMethod === "password" && (
            <div className="relative">
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--secondary)] pointer-events-none">
                <Lock size={18} />
              </span>
              <input
                className="ios-input w-full pr-10 pl-10 text-right"
                type={showPassword ? "text" : "password"}
                placeholder="رمز عبور"
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                style={{ textAlign: "right", direction: "rtl" }}
              />
              <button
                type="button"
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--secondary)] active:opacity-60"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          )}
        </div>

        {/* یادم بنداز */}
        <div className="flex items-center justify-between mb-5">
          <span className="text-[14px] text-[var(--label)]">یادم بنداز</span>
          <RememberToggle />
        </div>

        {/* خطا */}
        {err && (
          <p className="text-ios-red text-[13px] text-center mb-3">{err}</p>
        )}

        {/* دکمه اصلی */}
        <button
          onClick={handleSubmit}
          disabled={busy || (!supported && authMethod === "passkey")}
          className="w-full h-14 rounded-full text-white text-[16px] font-bold flex items-center justify-center gap-2.5 active:scale-[0.97] transition disabled:opacity-50"
          style={{
            background: "linear-gradient(135deg, #f5956b 0%, #e8724a 55%, #d4572d 100%)",
            boxShadow: "0 8px 28px -8px rgba(130,103,242,0.55)",
          }}
        >
          {busy ? (
            <Spinner />
          ) : authMethod === "password" ? (
            <>
              <Lock size={18} />
              {isLogin ? "ورود" : "ساخت حساب"}
            </>
          ) : (
            <>
              <KeyRound size={18} />
              {isLogin ? "ورود با پسکی" : "ساخت حساب با پسکی"}
            </>
          )}
        </button>

        {/* سوئیچ ورود / ثبت‌نام */}
        <p className="text-center text-[14px] mt-5 text-[var(--secondary)]">
          {isLogin ? "حساب نداری؟ " : "قبلاً حساب داری؟ "}
          <button
            className="text-ios-peach font-semibold active:opacity-60"
            onClick={() => { setErr(""); setMode(isLogin ? "register" : "login"); }}
            disabled={busy}
          >
            {isLogin ? "ثبت‌نام" : "ورود"}
          </button>
        </p>

        {!supported && authMethod === "passkey" && (
          <p className="text-[var(--secondary)] text-center text-[12px] mt-3 leading-6">
            مرورگر شما از پسکی پشتیبانی نمی‌کند. روش رمز عبور را انتخاب کن.
          </p>
        )}
      </div>
    </div>
  );
}

function SplashScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <div
      className="relative min-h-[100dvh] flex flex-col items-center justify-between overflow-hidden px-6 pt-[max(60px,env(safe-area-inset-top))] pb-[max(48px,env(safe-area-inset-bottom))]"
      style={{ background: "linear-gradient(160deg, #f5956b 0%, #e8724a 55%, #d4572d 100%)" }}
    >
      {/* هاله‌های پس‌زمینه */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-16 -right-16 h-64 w-64 rounded-full blur-3xl opacity-30 bg-white animate-float" />
        <div className="absolute bottom-24 -left-16 h-56 w-56 rounded-full blur-3xl opacity-20 bg-[#2cb8cf] animate-float" style={{ animationDelay: "-3s" }} />
      </div>

      {/* محتوای مرکزی */}
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="relative mb-8">
          <div className="absolute inset-0 rounded-full blur-3xl opacity-50 bg-white/40 scale-150" />
          <div className="relative h-28 w-28 rounded-[36px] bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center animate-float shadow-[0_20px_60px_-10px_rgba(255,255,255,0.35)]">
            <Logo size={60} color="white" />
          </div>
        </div>
        <h1 className="text-[42px] font-extrabold tracking-tight text-white leading-tight">{APP}</h1>
        <p className="text-white/75 text-[17px] mt-2 font-medium tracking-wide">{TAGLINE}</p>
      </div>

      {/* دکمه ادامه */}
      <button
        onClick={onContinue}
        className="h-14 w-14 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white active:scale-90 transition shadow-[0_8px_24px_-8px_rgba(0,0,0,0.25)]"
        aria-label="ادامه"
      >
        <ChevronDown />
      </button>
    </div>
  );
}

function MethodButton({
  active,
  onClick,
  disabled,
  children,
  label,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-full border text-[14px] font-semibold transition active:scale-95 ${
        active
          ? "border-ios-peach bg-ios-peach/10 text-ios-peach"
          : "border-[var(--secondary)]/25 text-[var(--secondary)] bg-transparent"
      } disabled:opacity-40`}
    >
      {children}
      {label}
    </button>
  );
}

function RememberToggle() {
  const [on, setOn] = useState(true);
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => setOn((v) => !v)}
      className={`relative h-7 w-12 rounded-full transition-colors duration-200 ${on ? "bg-ios-peach" : "bg-[var(--secondary)]/30"}`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-200 ${on ? "translate-x-0.5" : "-translate-x-5"}`}
        style={{ right: on ? undefined : "2px", left: on ? "2px" : undefined }}
      />
    </button>
  );
}

function Onboarding({ onStart, onLogin }: { onStart: () => void; onLogin: () => void }) {
  const [i, setI] = useState(0);
  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;
  const grad = `linear-gradient(135deg, ${s.grad[0]}, ${s.grad[1]})`;

  return (
    <div className="relative min-h-[100dvh] flex flex-col overflow-hidden px-6 pt-[max(18px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))]">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -right-16 h-64 w-64 rounded-full blur-3xl opacity-50 animate-float" style={{ background: `linear-gradient(135deg,${s.grad[0]},${s.grad[1]})` }} />
        <div className="absolute -bottom-24 right-1/4 h-64 w-64 rounded-full blur-3xl opacity-30 animate-float" style={{ background: `linear-gradient(135deg,${s.grad[1]},${s.grad[0]})`, animationDelay: "-4s" }} />
      </div>

      <div className="relative z-10 flex items-center justify-between h-10" dir="rtl">
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
          <div className="absolute h-56 w-56 rounded-full blur-3xl opacity-60" style={{ background: grad }} />
          <div
            className="relative h-40 w-40 rounded-[46px] flex items-center justify-center text-white animate-float"
            style={{
              backgroundImage: grad,
              boxShadow: "0 26px 60px -16px rgba(220,100,50,0.45), inset 0 2px 0 rgba(255,255,255,0.45)",
            }}
          >
            <AppIcon name={s.icon} size={68} strokeWidth={1.6} />
          </div>
        </div>
        <h2 className="text-[30px] font-extrabold tracking-tight leading-tight px-2">{s.title}</h2>
        <p className="secondary text-[16px] leading-8 mt-3 max-w-xs">{s.desc}</p>
      </div>

      <div className="relative z-10 space-y-5">
        <div className="flex items-center justify-center gap-2">
          {SLIDES.map((_, idx) => (
            <span
              key={idx}
              className={`h-2 rounded-full transition-all duration-300 ${idx === i ? "w-7 bg-ios-peach" : "w-2 bg-[var(--secondary)]/45"}`}
            />
          ))}
        </div>
        <button
          onClick={last ? onStart : () => setI(i + 1)}
          className="w-full h-14 rounded-full text-white text-[16px] font-bold flex items-center justify-center gap-2.5 active:scale-[0.97] transition"
          style={{
            background: "linear-gradient(135deg, #f5956b 0%, #e8724a 55%, #d4572d 100%)",
            boxShadow: "0 8px 28px -8px rgba(130,103,242,0.55)",
          }}
        >
          {last ? (
            <>بزن بریم <AppIcon name="rocket" size={19} /></>
          ) : (
            <>بعدی <ChevronLeft /></>
          )}
        </button>
        <button onClick={onLogin} className="w-full text-center text-ios-peach text-[15px] font-medium active:opacity-60">
          قبلاً حساب دارم؟ ورود
        </button>
      </div>
    </div>
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

function FingerprintIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.5 12.5A6.8 6.8 0 0 1 12 5a6.8 6.8 0 0 1 6.5 4.9" />
      <path d="M8.4 8.4A5 5 0 0 1 17 11c0 1.8-.2 3.5-.7 5.1" />
      <path d="M12 11c0 4.2-.8 6.4-1.7 8" />
      <path d="M14.4 11c0 3.8.3 5.8.9 7" />
    </svg>
  );
}

function humanize(msg?: string): string {
  if (!msg) return "خطایی رخ داد. دوباره تلاش کن.";
  if (/NotAllowed|timed out|aborted/i.test(msg)) return "عملیات لغو شد یا منقضی شد.";
  if (/already/i.test(msg)) return "این نام کاربری قبلاً ثبت شده است.";
  return msg;
}
