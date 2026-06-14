"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AppIcon } from "@/components/AppIcon";
import { Mascot } from "@/components/Mascot";
import { Logo } from "@/components/icons";
import { apiSend, ApiError } from "@/lib/client";

/* ─── ثوابت ──────────────────────────────────────────────────── */

const APP = process.env.NEXT_PUBLIC_APP_NAME || "امروز";

/* ─── UTM tracking ───────────────────────────────────────────── */

function useTrack() {
  const params = useSearchParams();
  useEffect(() => {
    const utmProps: Record<string, string> = {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "ref"].forEach((k) => {
      const v = params.get(k);
      if (v) utmProps[k] = v;
    });
    fetch("/api/events/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "landing_view", props: utmProps }),
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return params;
}

/* ─── دکمه‌ی ورود مهمان ─────────────────────────────────────── */

function GuestButton({ children, className = "" }: { children: ReactNode; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const go = async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await apiSend("/api/auth/guest", "POST");
      router.push("/grow?seg=habits");
    } catch (e) {
      // خطا را هرگز بی‌صدا نخور: کاربر باید بفهمد چه شد و کلیک هدر نرود.
      // روی شبکه‌های CGNATِ ایران، ۴۲۹ زیاد رخ می‌دهد؛ پس مستقیم سمتِ ورود با شماره هلش بده.
      const ae = e as ApiError;
      setErr(
        ae?.status === 429
          ? "ورودِ سریع از این شبکه شلوغه — با شماره موبایل وارد شو 👇"
          : (ae?.message || "ورود یه لحظه قطع شد؛ دوباره بزن یا با شماره وارد شو 👇")
      );
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className={`ios-btn-primary flex items-center justify-center gap-2 disabled:opacity-70 ${className}`}
      >
        {busy ? (
          <span className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
        ) : (
          children
        )}
      </button>
      {err && <p className="w-full text-center text-[13px] leading-6 text-ios-red mt-1.5">{err}</p>}
    </>
  );
}

/* ─── کمپوننت فید-اَپ ────────────────────────────────────────── */

function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setShown(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={className} style={{ opacity: shown ? 1 : 0, transform: shown ? "none" : "translateY(20px)", transition: `opacity .6s cubic-bezier(.16,1,.3,1) ${delay}ms, transform .6s cubic-bezier(.16,1,.3,1) ${delay}ms` }}>
      {children}
    </div>
  );
}

/* ─── چت دمو ─────────────────────────────────────────────────── */

type Msg = { who: "user" | "bot"; text: string };

const CHAT_SCRIPT: Msg[] = [
  { who: "user", text: "دو تا تخم‌مرغ با نون خوردم" },
  { who: "bot",  text: "ثبت شد 🌱 حدوداً ۲۸۰ کالری. روزت چطور می‌گذره؟" },
  { who: "user", text: "خوبه. امروز ورزش هم کردم" },
  { who: "bot",  text: "عالی! ورزش تیک خورد ✅ ۵ روز پشت سره 🔥 داری خوب پیش می‌ری." },
];

function ChatDemo() {
  const [visible, setVisible] = useState<Msg[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        CHAT_SCRIPT.forEach((msg, i) => {
          setTimeout(() => setVisible((prev) => [...prev, msg]), i * 900 + 400);
        });
        io.disconnect();
      }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="card !rounded-[28px] p-4 space-y-3 min-h-[200px]">
      <div className="flex items-center gap-2.5 border-b border-[var(--sep)] pb-3 mb-1">
        <span className="h-8 w-8 rounded-full bg-gradient-to-br from-[#6a8bff] to-[#8267f2] flex items-center justify-center text-white text-[14px] font-bold">🌱</span>
        <div>
          <p className="text-[14px] font-bold leading-none">جوانه</p>
          <p className="text-[11px] secondary mt-0.5">مربی هوشمند</p>
        </div>
        <span className="mr-auto chip !text-[11px] !py-0.5 !px-2 bg-ios-green/10 text-ios-green">آنلاین</span>
      </div>
      {visible.map((msg, i) => (
        <div key={i} className={`flex gap-2 ${msg.who === "user" ? "justify-end" : "justify-start"}`}>
          {msg.who === "bot" && (
            <span className="h-7 w-7 rounded-full bg-gradient-to-br from-[#6a8bff] to-[#8267f2] flex items-center justify-center text-white text-[12px] shrink-0 mt-0.5">🌱</span>
          )}
          <div
            className="rounded-[18px] px-4 py-2.5 max-w-[78%] text-[14px] leading-6"
            style={
              msg.who === "user"
                ? { background: "var(--ios-indigo,#5b76f0)", color: "#fff" }
                : { background: "color-mix(in srgb, var(--card-solid) 60%, transparent)", border: "1px solid var(--sep)" }
            }
          >
            {msg.text}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── قیمت‌گذاری ────────────────────────────────────────────── */

const PLANS = [
  {
    name: "رایگان",
    price: "۰",
    unit: "",
    color: "#22c391",
    features: ["ثبتِ نامحدود کالری، بودجه، آب و عادت", "۵ گفتگو با جوانه در روز", "یادآوری روزانه"],
    cta: "همین الان شروع کن",
    highlight: false,
  },
  {
    name: "پلاس",
    price: "۸۹٬۰۰۰",
    unit: "ت/ماه",
    color: "#6a8bff",
    features: ["گفتگوی نامحدود با جوانه", "تحلیل عکس غذا، برنامه‌ی تمرین و تغذیه (۵ در روز)", "مرور هوشمند هفتگی"],
    cta: "شروع با پلاس",
    highlight: true,
  },
  {
    name: "پرو",
    price: "۱۵۹٬۰۰۰",
    unit: "ت/ماه",
    color: "#a96ff0",
    features: ["همه‌ی پلاس — بدون سقف", "مشاور سرمایه‌گذاری", "اولویت در پاسخ"],
    cta: "شروع با پرو",
    highlight: false,
  },
];

/* ─── پرسش‌های متداول ────────────────────────────────────────── */

const FAQS = [
  {
    q: "اگه ول کنم چی می‌شه؟",
    a: "هیچی بدی نمی‌شه 🌱 جوانه هر روز صبح با یه پیام کوتاه سراغت میاد و از همون‌جا که موندی ادامه می‌دی — بدون قضاوت، بدون سرزنش.",
  },
  {
    q: "با اپ‌های دیگه چه فرقی داره؟",
    a: "بیشترِ اپ‌ها ثبت می‌کنن؛ جوانه می‌فهمه. می‌گی «نون خوردم»، خودش کالری رو تخمین می‌زنه و ثبت می‌کنه — بدون فرم، بدون دکمه.",
  },
  {
    q: "چقدر هزینه داره؟",
    a: "پلن رایگان همیشگیه: ثبتِ نامحدود و روزی ۵ گفتگو با جوانه. گفتگوی نامحدود خواستی، پلاس ماهی ۸۹ هزار تومنه — کمتر از یه پیتزا.",
  },
  {
    q: "داده‌هام امنه؟",
    a: "سرورها توی ایرانه، داده‌ات به هیچ‌کس فروخته نمی‌شه و رمز عبوری هم در کار نیست که لو بره.",
  },
  {
    q: "روی آیفون هم کار می‌کنه؟",
    a: "بله. در سافاری باز کن، از «افزودن به صفحه‌ی خانه» نصب کن — مثل یه اپ واقعی باز می‌شه.",
  },
];

/* ─── صفحه‌ی اصلی ───────────────────────────────────────────── */

export default function StartPage() {
  const params = useTrack();
  const loginHref = `/login?ref=start${params.get("utm_source") ? `&utm_source=${params.get("utm_source")}` : ""}`;

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden" dir="rtl">
      {/* پس‌زمینه‌ی رنگی */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 -right-24 h-96 w-96 rounded-full blur-3xl opacity-30"
          style={{ background: "linear-gradient(135deg,#8267f2,#6a8bff)" }} />
        <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full blur-3xl opacity-20"
          style={{ background: "linear-gradient(135deg,#2cb8cf,#6a8bff)" }} />
      </div>

      {/* ── ناوبار ── */}
      <header className="sticky top-0 z-40 glass border-b border-[var(--border)]">
        <div className="mx-auto max-w-2xl px-5 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="h-8 w-8 rounded-[12px] bg-gradient-to-br from-[#6a8bff] via-ios-indigo to-ios-purple flex items-center justify-center">
              <Logo size={18} />
            </span>
            <span className="font-display text-[22px] font-bold grad-text">{APP}</span>
          </div>
          <GuestButton className="text-[14px] !py-2 !px-4 !rounded-[14px]">
            <AppIcon name="rocket" size={15} /> رایگان شروع کن
          </GuestButton>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 pb-24">

        {/* ── هیرو ── */}
        <section className="pt-10 pb-8 text-center">
          <div className="flex justify-center mb-5">
            <Mascot size={110} pose="wave" float shadow />
          </div>

          <span className="chip border border-[var(--border)] !text-[13px] mb-5">
            <AppIcon name="sparkles" size={14} className="text-ios-indigo" />
            مربی هوشمندِ فارسی‌زبان
          </span>

          <h1 className="font-display font-bold tracking-tight leading-[1.0] text-[clamp(38px,10vw,64px)] mt-3">
            می‌دونی چیکار باید کنی.
            <br />
            <span className="grad-text">نمی‌کنیش.</span>
          </h1>

          <p className="secondary text-[16px] sm:text-[18px] leading-8 mt-5 max-w-md mx-auto">
            جوانه هر روز کنارته — کالری، بودجه و عادت‌هات رو با هم مدیریت می‌کنه.
            <br />
            بدون قضاوت. بدون سرزنش.
          </p>

          <div className="mt-7 flex flex-col gap-3">
            <GuestButton className="w-full text-[17px] !py-4 shadow-glow">
              <AppIcon name="rocket" size={20} /> بدون حساب، همین الان شروع کن
            </GuestButton>
            <Link href={loginHref} className="ios-btn-ghost w-full flex items-center justify-center gap-2 text-[16px] !py-3.5">
              <AppIcon name="phone" size={18} /> ورود با شماره موبایل
            </Link>
          </div>

          <div className="mt-5 flex items-center justify-center gap-5 secondary text-[12px]">
            <span className="flex items-center gap-1">
              <AppIcon name="check" size={13} className="text-ios-green" /> کارت نمی‌خواد
            </span>
            <span className="flex items-center gap-1">
              <AppIcon name="check" size={13} className="text-ios-green" /> شروعش رایگانه
            </span>
            <span className="flex items-center gap-1">
              <AppIcon name="check" size={13} className="text-ios-green" /> روی آیفون و اندروید
            </span>
          </div>
        </section>

        {/* ── مشکل ── */}
        <Reveal>
          <section className="py-8">
            <div className="card !rounded-[28px] p-7 text-center">
              <p className="text-[22px] sm:text-[26px] font-bold leading-9">
                کتاب خوندی. اپ نصب کردی.
                <br />
                یه هفته رفتی. <span className="text-ios-red">ول کردی.</span>
              </p>
              <p className="secondary text-[15px] leading-7 mt-4 max-w-sm mx-auto">
                مشکل اراده نیست — مشکل اینه که <strong className="text-[var(--label)]">تنهایی.</strong>
                <br />
                وقتی یه نفر هر روز ازت می‌پرسه «چطوری؟» همه چیز فرق می‌کنه.
              </p>
            </div>
          </section>
        </Reveal>

        {/* ── دمو چت ── */}
        <Reveal delay={60}>
          <section className="py-6">
            <p className="text-[13px] secondary text-center mb-4">جوانه چطور کار می‌کنه؟</p>
            <ChatDemo />
            <p className="text-[12px] secondary text-center mt-3">
              فقط بنویس چی خوردی — کالری خودکار ثبت می‌شه
            </p>
          </section>
        </Reveal>

        {/* ── چطور کار می‌کنه ── */}
        <Reveal delay={80}>
          <section className="py-8">
            <h2 className="font-display text-[28px] sm:text-[34px] font-bold text-center mb-6">
              در سه قدم شروع کن
            </h2>
            <div className="space-y-3">
              {[
                { n: "۱", icon: "star", color: "#8267f2", title: "هدفت رو بگو", desc: "جوانه می‌پرسه چی می‌خوای — لاغری، بودجه، عادت جدید، هر چی." },
                { n: "۲", icon: "compass", color: "#6a8bff", title: "هر روز یه قدم", desc: "یه عادتِ کوچیک. یه ماموریتِ کوچیک. فشار نیست — فقط همین امروز." },
                { n: "۳", icon: "chart", color: "#22c391", title: "جوانه کنارته", desc: "هر روز صبح بهت سر می‌زنه؛ اگه یه روز جا موندی، بدون سرزنش از همون‌جا ادامه می‌دی." },
              ].map((s) => (
                <div key={s.n} className="card !rounded-[22px] p-5 flex items-center gap-4">
                  <span className="h-12 w-12 rounded-[16px] flex items-center justify-center text-white shrink-0"
                    style={{ background: `linear-gradient(135deg, ${s.color}, ${s.color}cc)` }}>
                    <AppIcon name={s.icon} size={22} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-[16px]">{s.title}</p>
                    <p className="secondary text-[13px] leading-6 mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </Reveal>

        {/* ── قیمت‌گذاری ── */}
        <Reveal delay={60}>
          <section className="py-8">
            <h2 className="font-display text-[28px] sm:text-[34px] font-bold text-center mb-2">قیمت‌گذاری</h2>
            <p className="secondary text-[14px] text-center mb-6">ثبت و پیگیری همیشه رایگانه؛ پلن‌ها فقط هوشِ جوانه رو بازتر می‌کنن</p>
            <div className="space-y-3">
              {PLANS.map((plan) => (
                <div key={plan.name} className={`card !rounded-[22px] p-5 relative overflow-hidden ${plan.highlight ? "border-2" : ""}`}
                  style={plan.highlight ? { borderColor: plan.color + "88" } : undefined}>
                  {plan.highlight && (
                    <span className="absolute top-3 left-3 chip text-white !text-[11px] !px-2.5 !py-1"
                      style={{ background: plan.color }}>
                      پیشنهاد ما
                    </span>
                  )}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-[18px]">{plan.name}</p>
                      <ul className="mt-2 space-y-1">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-center gap-1.5 secondary text-[13px]">
                            <AppIcon name="check" size={13} style={{ color: plan.color }} />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="text-left shrink-0">
                      <p className="font-display text-[28px] font-bold leading-none" style={{ color: plan.color }}>
                        {plan.price}
                      </p>
                      {plan.unit && <p className="secondary text-[12px] mt-0.5">{plan.unit}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </Reveal>

        {/* ── FAQ ── */}
        <Reveal delay={60}>
          <section className="py-8">
            <h2 className="font-display text-[28px] sm:text-[34px] font-bold text-center mb-6">سوالات رایج</h2>
            <div className="space-y-2">
              {FAQS.map((f) => (
                <details key={f.q} className="card !rounded-[20px] group p-0 overflow-hidden">
                  <summary className="flex items-center justify-between gap-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden px-5 py-4 select-none">
                    <span className="font-bold text-[15px] leading-tight">{f.q}</span>
                    <span className="h-6 w-6 rounded-full bg-ios-indigo/10 text-ios-indigo flex items-center justify-center shrink-0 transition-transform duration-300 group-open:rotate-45">
                      <AppIcon name="plus" size={15} />
                    </span>
                  </summary>
                  <p className="secondary text-[14px] leading-7 px-5 pb-4 -mt-1">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        </Reveal>

        {/* ── CTA نهایی ── */}
        <Reveal delay={60}>
          <section className="py-8">
            <div className="relative overflow-hidden rounded-[28px] p-8 text-center text-white"
              style={{ backgroundImage: "linear-gradient(135deg,#6a8bff 0%,#8267f2 60%,#a96ff0 100%)" }}>
              <div aria-hidden className="absolute -top-16 left-1/3 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
              <div className="relative">
                <p className="font-display text-[28px] sm:text-[36px] font-bold leading-tight">
                  همین امروز شروع کن
                </p>
                <p className="text-white/85 text-[15px] mt-2 mb-6">
                  شروعش رایگانه، کارت نمی‌خواد و یه دقیقه هم طول نمی‌کشه.
                </p>
                <GuestButton className="w-full !bg-white !text-ios-indigo text-[16px] !py-4 shadow-lg hover:!bg-white/90">
                  <AppIcon name="rocket" size={18} /> بدون حساب شروع کن
                </GuestButton>
                <Link href={loginHref} className="block mt-3 text-white/80 text-[14px] font-semibold underline-offset-4 hover:underline active:opacity-70">
                  یا با شماره موبایل وارد شو ←
                </Link>
              </div>
            </div>
          </section>
        </Reveal>

      </main>

      {/* ── فوتر ── */}
      <footer className="border-t border-[var(--border)] glass">
        <div className="mx-auto max-w-2xl px-5 py-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="h-7 w-7 rounded-[10px] bg-gradient-to-br from-[#6a8bff] to-ios-purple flex items-center justify-center">
              <Logo size={15} />
            </span>
            <span className="font-display grad-text font-bold text-[18px]">{APP}</span>
          </div>
          <div className="flex items-center gap-4 secondary text-[13px]">
            <Link href="/legal" className="hover:text-[var(--label)] transition">حریم خصوصی</Link>
            <Link href="/landing" className="hover:text-[var(--label)] transition">درباره‌ی اپ</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
