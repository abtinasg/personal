"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser";
import { apiSend } from "@/lib/client";
import { Button, Spinner, Segmented } from "@/components/ui";
import { Logo } from "@/components/icons";
import { AppIcon } from "@/components/AppIcon";
import { KeyRound, Lock } from "lucide-react";

const APP = process.env.NEXT_PUBLIC_APP_NAME || "یک‌درصد";
const ONBOARD_KEY = "zendegi:onboarded";

type Screen = "splash" | "onboarding" | "auth";
type AuthMethod = "passkey" | "password";

const SLIDES: { icon: string; title: string; desc: string; grad: [string, string] }[] = [
  {
    icon: "chart",
    title: "به یک‌درصد خوش اومدی",
    desc: "هر روز فقط یک‌درصد بهتر. همین رأیِ کوچکِ روزانه، در یک سال تو را ۳۷ برابر می‌کند.",
    grad: ["#8267f2", "#6a8bff"],
  },
  {
    icon: "rocket",
    title: "هدف‌هایت را زنده کن",
    desc: "ماموریت بساز و آن را به عادت‌های اتمیِ روزانه بشکن؛ پیشرفتت را با حلقه‌ها زنده ببین.",
    grad: ["#5b76f0", "#2cb8cf"],
  },
  {
    icon: "flame",
    title: "همه‌چیز، یک‌جا",
    desc: "کالری، بودجه، آب و سلامتی — با ثبتِ سریع و هوشمند، بی‌شلوغی و آرام.",
    grad: ["#fb9a5b", "#fb7fa0"],
  },
  {
    icon: "compass",
    title: "مربیِ همیشه‌همراه",
    desc: "یک مربیِ هوشمند کنارت است و ورودت بی‌رمز و امن، فقط با پسکی انجام می‌شود.",
    grad: ["#a96ff0", "#8267f2"],
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>("splash");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [authMethod, setAuthMethod] = useState<AuthMethod>("passkey");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(browserSupportsWebAuthn());
    let onboarded = false;
    try {
      onboarded = localStorage.getItem(ONBOARD_KEY) === "1";
    } catch {
      /* حافظهٔ مرورگر در دسترس نبود */
    }
    setMode(onboarded ? "login" : "register");
    setScreen(onboarded ? "auth" : "onboarding");
  }, []);

  function finishOnboarding(next: "login" | "register") {
    try {
      localStorage.setItem(ONBOARD_KEY, "1");
    } catch {
      /* noop */
    }
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
      await apiSend("/api/auth/register/password", "POST", {
        username,
        password,
      });
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
      await apiSend("/api/auth/login/password", "POST", {
        username,
        password,
      });
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
    return (
      <div className="relative min-h-[100dvh] flex items-center justify-center overflow-hidden">
        <Blobs />
        <div className="relative h-24 w-24 rounded-[30px] bg-gradient-to-br from-[#6a8bff] via-ios-indigo to-ios-purple shadow-glow flex items-center justify-center animate-float">
          <Logo size={52} />
        </div>
      </div>
    );
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

  return (
    <div className="relative min-h-[100dvh] flex flex-col items-center justify-center px-6 overflow-hidden">
      <Blobs />

      <div className="relative w-full max-w-sm animate-fade-up">
        <div className="text-center mb-9">
          <div className="relative mx-auto mb-6 grid h-24 w-24 place-items-center">
            <div
              className="absolute h-24 w-24 rounded-full blur-2xl opacity-70"
              style={{ background: "linear-gradient(135deg,#8267f2,#a96ff0)" }}
            />
            <div className="relative h-24 w-24 rounded-[30px] bg-gradient-to-br from-[#6a8bff] via-ios-indigo to-ios-purple shadow-glow flex items-center justify-center animate-float">
              <Logo size={52} />
            </div>
          </div>
          <h1 className="text-[36px] font-extrabold tracking-tight grad-text leading-tight">{APP}</h1>
          <p className="secondary text-[16px] mt-1.5">
            {isLogin ? "خوش برگشتی! ورود کن." : "بیا حسابت رو بسازیم."}
          </p>
        </div>

        {!supported && (
          <p className="text-ios-red text-center text-[14px] mb-4">
            مرورگر شما از پسکی پشتیبانی نمی‌کند. لطفاً از Safari یا Chrome به‌روز استفاده کن.
          </p>
        )}

        {/* کارتِ لایه‌ای و شناور */}
        <div className="relative">
          <div className="card absolute inset-x-6 -bottom-2.5 top-3 -z-10 opacity-60" aria-hidden />
          <div className="float-card relative p-6 space-y-4">
            {/* تب‌های روش احراز */}
            <Segmented
              value={authMethod}
              onChange={(v) => {
                setAuthMethod(v);
                setErr("");
                if (v === "passkey") setPassword("");
              }}
              options={[
                { value: "passkey", label: "پسکی" },
                { value: "password", label: "رمز عبور" },
              ]}
            />

            <input
              className="ios-input text-center"
              placeholder="نام کاربری"
              dir="ltr"
              autoCapitalize="none"
              autoCorrect="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={busy}
            />

            {authMethod === "password" && (
              <input
                className="ios-input text-center"
                type="password"
                placeholder="رمز عبور"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
              />
            )}

            <Button
              onClick={
                authMethod === "password"
                  ? isLogin
                    ? loginWithPassword
                    : registerWithPassword
                  : isLogin
                  ? login
                  : register
              }
              disabled={busy || (!supported && authMethod === "passkey")}
              className="w-full flex items-center justify-center gap-2"
            >
              {busy ? (
                <Spinner />
              ) : authMethod === "password" ? (
                <Lock size={19} />
              ) : isLogin ? (
                <KeyRound size={19} />
              ) : (
                <AppIcon name="sparkles" size={19} />
              )}
              {busy
                ? ""
                : authMethod === "password"
                ? isLogin
                  ? "ورود با رمز عبور"
                  : "ساخت حساب با رمز"
                : isLogin
                ? "ورود با پسکی"
                : "ساخت حساب با پسکی"}
            </Button>

            {err && <p className="text-ios-red text-[14px] text-center">{err}</p>}

            {authMethod === "passkey" && (
              <div className="flex items-center justify-center gap-2 pt-1 text-[var(--secondary)]">
                <Fingerprint />
                <span className="text-[12px]">Face ID · Touch ID · پین دستگاه</span>
              </div>
            )}
          </div>
        </div>

        <button
          className="w-full text-center mt-5 text-ios-blue text-[15px] font-medium active:opacity-60"
          onClick={() => {
            setErr("");
            setMode(isLogin ? "register" : "login");
          }}
          disabled={busy}
        >
          {isLogin ? "حساب نداری؟ یک حساب جدید بساز" : "قبلاً ثبت‌نام کرده‌ای؟ وارد شو"}
        </button>

        <p className="secondary text-center text-[12px] mt-7 leading-6">
          می‌تونی از پسکی (بی‌رمز) یا رمز عبور استفاده کنی. اطلاعاتت امن و خصوصی روی حساب خودت ذخیره می‌شود.
        </p>
      </div>
    </div>
  );
}

function Onboarding({ onStart, onLogin }: { onStart: () => void; onLogin: () => void }) {
  const [i, setI] = useState(0);
  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;
  const grad = `linear-gradient(135deg, ${s.grad[0]}, ${s.grad[1]})`;

  return (
    <div className="relative min-h-[100dvh] flex flex-col overflow-hidden px-6 pt-[max(18px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))]">
      <Blobs />

      {/* ردیفِ بالا: قبلی / رد کردن */}
      <div className="relative z-10 flex items-center justify-between h-10">
        {i > 0 ? (
          <button
            onClick={() => setI(i - 1)}
            aria-label="قبلی"
            className="h-10 w-10 -mr-1 rounded-full glass border border-[var(--border)] flex items-center justify-center text-[var(--secondary)] active:scale-90 transition"
          >
            <Chevron dir="right" />
          </button>
        ) : (
          <span className="w-10" />
        )}
        <button onClick={onStart} className="secondary text-[15px] font-semibold active:opacity-60">
          رد کردن
        </button>
      </div>

      {/* محتوای اسلاید */}
      <div key={i} className="relative z-10 flex-1 flex flex-col items-center justify-center text-center animate-fade-up">
        <div className="relative mb-10 grid place-items-center">
          <div className="absolute h-56 w-56 rounded-full blur-3xl opacity-60" style={{ background: grad }} />
          <div
            className="relative h-40 w-40 rounded-[46px] flex items-center justify-center text-white animate-float"
            style={{
              backgroundImage: grad,
              boxShadow: "0 26px 60px -16px rgba(76,70,160,0.5), inset 0 2px 0 rgba(255,255,255,0.45)",
            }}
          >
            <AppIcon name={s.icon} size={68} strokeWidth={1.6} />
          </div>
        </div>
        <h2 className="text-[30px] font-extrabold tracking-tight leading-tight px-2">{s.title}</h2>
        <p className="secondary text-[16px] leading-8 mt-3 max-w-xs">{s.desc}</p>
      </div>

      {/* پایین: نقطه‌ها + اکشن */}
      <div className="relative z-10 space-y-5">
        <div className="flex items-center justify-center gap-2">
          {SLIDES.map((_, idx) => (
            <span
              key={idx}
              className={`h-2 rounded-full transition-all duration-300 ${
                idx === i ? "w-7 bg-ios-indigo" : "w-2 bg-[var(--secondary)]/45"
              }`}
            />
          ))}
        </div>
        <Button
          onClick={last ? onStart : () => setI(i + 1)}
          className="w-full flex items-center justify-center gap-2"
        >
          {last ? (
            <>
              بزن بریم <AppIcon name="rocket" size={19} />
            </>
          ) : (
            <>
              بعدی <Chevron dir="left" />
            </>
          )}
        </Button>
        <button onClick={onLogin} className="w-full text-center text-ios-blue text-[15px] font-medium active:opacity-60">
          قبلاً حساب دارم؟ ورود
        </button>
      </div>
    </div>
  );
}

/** هاله‌های گرادیانیِ شناور برای عمقِ رؤیایی. */
function Blobs() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute -top-20 -right-16 h-64 w-64 rounded-full blur-3xl opacity-50 animate-float"
        style={{ background: "linear-gradient(135deg,#8267f2,#6a8bff)" }}
      />
      <div
        className="absolute top-1/3 -left-24 h-56 w-56 rounded-full blur-3xl opacity-40 animate-float"
        style={{ background: "linear-gradient(135deg,#2cb8cf,#6a8bff)", animationDelay: "-2.2s" }}
      />
      <div
        className="absolute -bottom-24 right-1/4 h-64 w-64 rounded-full blur-3xl opacity-40 animate-float"
        style={{ background: "linear-gradient(135deg,#fb7fa0,#fb9a5b)", animationDelay: "-4.4s" }}
      />
    </div>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      {dir === "left" ? <path d="m15 18-6-6 6-6" /> : <path d="m9 18 6-6-6-6" />}
    </svg>
  );
}

function Fingerprint() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
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
