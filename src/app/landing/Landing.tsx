"use client";

import Link from "next/link";
import { ReactNode, useEffect, useRef, useState } from "react";
import { Logo } from "@/components/icons";
import { AppIcon } from "@/components/AppIcon";
import { Ring } from "@/components/ui";

const BRAND = "امروز";
const SLOGAN = "همین امروز";

/* نصبِ PWA ─────────────────────────────────────────────────
   رویدادِ beforeinstallprompt ممکن است پیش از mountـِ کامپوننت‌ها
   شلیک شود؛ پس آن را در سطحِ ماژول می‌گیریم و مشترکین را خبر می‌کنیم. */

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: BIPEvent | null = null;
const installSubs = new Set<() => void>();
const notifyInstall = () => installSubs.forEach((fn) => fn());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BIPEvent;
    notifyInstall();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notifyInstall();
  });
}

type Platform = "ios" | "android" | "desktop";

function useInstall() {
  const [canPrompt, setCanPrompt] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<Platform>("desktop");

  useEffect(() => {
    const sync = () => setCanPrompt(!!deferredPrompt);
    installSubs.add(sync);
    sync();

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);

    const ua = window.navigator.userAgent;
    const isIOS =
      /iphone|ipad|ipod/i.test(ua) ||
      (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
    setPlatform(isIOS ? "ios" : /android/i.test(ua) ? "android" : "desktop");

    return () => {
      installSubs.delete(sync);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      deferredPrompt = null;
      notifyInstall();
    }
    return outcome === "accepted";
  };

  return { canPrompt, installed, platform, promptInstall };
}

/* ابزارهای کوچک ───────────────────────────────────────────── */

const FA = "۰۱۲۳۴۵۶۷۸۹";
const faNum = (s: string | number) =>
  String(s).replace(/\d/g, (d) => FA[+d]).replace(/\./g, "٫").replace(/,/g, "٬");

// بافتِ دفترچه‌ایِ نقطه‌چین — حسِ سالنامه و کاغذِ مدرج
const ledger: React.CSSProperties = {
  backgroundImage:
    "radial-gradient(circle, rgba(38,42,64,0.10) 1px, transparent 1.5px)",
  backgroundSize: "22px 22px",
};

/* داده ───────────────────────────────────────────────────── */

type Feature = { icon: string; title: string; desc: string; color: string };

const FEATURES: Feature[] = [
  { icon: "star", color: "#8267f2", title: "هویت‌ها", desc: "اول انتخاب کن چه کسی می‌خواهی باشی؛ از آن به بعد، هر کارِ کوچک یک رأی به اوست." },
  { icon: "flag", color: "#5b76f0", title: "ماموریت‌ها", desc: "هدفِ بزرگ را بگو، نقشهٔ راه بگیر؛ جوانه آن را به قدم‌های قابل‌انجام می‌شکند." },
  { icon: "repeat", color: "#2cb8cf", title: "عادت‌های اتمی", desc: "عادت‌های کوچکِ روزانه، با حلقه‌های پیشرفت و زنجیره‌ای از روزها که دلت نمی‌آید بشکنی." },
  { icon: "flame", color: "#fb9a5b", title: "کالریِ هوشمند", desc: "از غذایت عکس بگیر یا یک جمله بنویس؛ کالری و درشت‌مغذی‌ها همان لحظه تخمین زده می‌شود." },
  { icon: "wallet", color: "#6a8bff", title: "بودجه و خرج", desc: "درآمد، هزینه و پس‌اندازت را ساده دنبال کن و سرِ بودجه‌ی ماهانه بمان." },
  { icon: "heart", color: "#fb7fa0", title: "سلامتی", desc: "آب، وزن، قدم و خواب — روندِ تنت، همیشه در یک نگاه." },
  { icon: "strength", color: "#a96ff0", title: "برنامه‌ی ورزشی", desc: "جوانه تمرینِ امروزت را متناسب با سطح و هدفت می‌چیند — از گرم‌کردن تا کشش." },
  { icon: "gift", color: "#f5c451", title: "جایزه و انگیزه", desc: "برای خودت جایزه تعریف کن و با روزهای پیاپیِ خوب بازش کن. انگیزه، بازی‌گونه." },
];

const STEPS: { icon: string; title: string; desc: string; color: string }[] = [
  { icon: "star", color: "#8267f2", title: "هویت‌ات را انتخاب کن", desc: "تصمیم بگیر می‌خواهی چه‌جور آدمی باشی — ورزشکار، اهلِ مطالعه، آرام، منظم." },
  { icon: "vote", color: "#5b76f0", title: "هر روز یک قدم بردار", desc: "یک عادتِ کوچک، یک ماموریتِ کوچک. همین. فشار نیست، فقط همین امروز." },
  { icon: "chart", color: "#22c391", title: "پیشرفتِ مرکب را ببین", desc: "حلقه‌ها پر می‌شوند، روزها پیاپی می‌شوند و «امروز»ها روی هم جمع می‌شوند." },
];

const COACH_POINTS: { icon: string; text: string }[] = [
  { icon: "sun", text: "بریفینگِ صبحگاهی، هر روز" },
  { icon: "compass", text: "گفتگو با جوانه، هر وقت گیر کردی" },
  { icon: "flame", text: "تخمینِ کالریِ عکس و متن" },
  { icon: "strength", text: "برنامه‌ی تمرینِ روزانه" },
  { icon: "chart", text: "مرورِ هوشمندِ هفتگی" },
];

const LEDGER_STATS: { value: string; label: string }[] = [
  { value: "۱٪", label: "بهتر، هر روز" },
  { value: "×۳۷٫۸", label: "ریاضیِ ۳۶۵ روزِ ۱٪" },
  { value: "+۱۰", label: "ابزار، در یک اپ" },
  { value: "۰", label: "رمزِ عبور — فقط پسکی" },
];

/* صفحه ───────────────────────────────────────────────────── */

export default function Landing() {
  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden">
      <Aurora />
      <Grain />
      <SideTag />
      <Nav />
      <main className="relative">
        <Hero />
        <LedgerStrip />
        <Compound />
        <Features />
        <Coach />
        <Steps />
        <Privacy />
        <Install />
        <Faq />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}

/* ناوبری ─────────────────────────────────────────────────── */

function Nav() {
  return (
    <header className="sticky top-0 z-40 glass border-b border-[var(--border)]">
      <div className="mx-auto max-w-6xl px-5 sm:px-8 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="h-9 w-9 rounded-[14px] bg-gradient-to-br from-[#6a8bff] via-ios-indigo to-ios-purple shadow-glow flex items-center justify-center">
            <Logo size={20} />
          </span>
          <span className="font-display text-[26px] font-bold leading-none grad-text">{BRAND}</span>
        </div>
        <nav className="hidden md:flex items-center gap-7 text-[15px] secondary font-medium">
          <a href="#compound" className="hover:text-[var(--label)] transition">رشدِ مرکب</a>
          <a href="#features" className="hover:text-[var(--label)] transition">قابلیت‌ها</a>
          <a href="#coach" className="hover:text-[var(--label)] transition">مربیِ هوشمند</a>
          <a href="#install" className="hover:text-[var(--label)] transition">نصبِ اپ</a>
        </nav>
        <InstallButton tone="gradient" className="text-[15px] !py-2.5 !px-5 shadow-glow">
          <AppIcon name="download" size={17} /> نصبِ اپ
        </InstallButton>
      </div>
    </header>
  );
}

/* قهرمان ─────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative mx-auto max-w-6xl px-5 sm:px-8 pt-16 sm:pt-24 pb-12">
      {/* عددِ غول‌پیکرِ پس‌زمینه — عنصرِ تایپوگرافیکِ شکنندهٔ شبکه */}
      <span
        aria-hidden
        className="font-display pointer-events-none select-none absolute -top-10 left-0 sm:-left-6 grad-text font-bold leading-none opacity-[0.10]"
        style={{ fontSize: "clamp(220px, 36vw, 560px)" }}
      >
        ۱٪
      </span>

      <div className="relative grid lg:grid-cols-12 gap-12 lg:gap-6 items-center">
        <div className="lg:col-span-7 text-center lg:text-right">
          <span className="chip border border-[var(--border)] shadow-soft !text-[13px] mb-7 animate-fade-up">
            <AppIcon name="sparkles" size={15} className="text-ios-indigo" />
            هویت‌ات را بساز، نه فقط فهرستِ کارها
          </span>

          <h1 className="font-display font-bold tracking-tight leading-[0.92] text-[clamp(56px,9vw,116px)] animate-fade-up [animation-delay:80ms]">
            <span className="block secondary/0 text-[var(--label)]">زندگی،</span>
            <span className="block grad-text">همین امروز</span>
            <span className="block">است.</span>
          </h1>

          <p className="secondary text-[17px] sm:text-[19px] leading-9 mt-7 max-w-xl mx-auto lg:mx-0 animate-fade-up [animation-delay:160ms]">
            آدمی که می‌خواهی بشوی، یک‌شبه ساخته نمی‌شود؛ از جمعِ همین «امروز»ها ساخته می‌شود.
            عادت‌ها، تغذیه، بودجه و سلامتی‌ات را یک‌جا ببین — و بگذار «جوانه»، مربیِ هوشمندت،
            هر روز قدمِ بعدی را روشن کند.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row items-center lg:justify-start justify-center gap-3 animate-fade-up [animation-delay:240ms]">
            <InstallButton tone="gradient" className="w-full sm:w-auto shadow-glow">
              <AppIcon name="download" size={19} /> نصبِ رایگانِ اپ
            </InstallButton>
            <Link href="/login" className="ios-btn-ghost w-full sm:w-auto flex items-center justify-center gap-2 active:scale-[0.97]">
              <AppIcon name="rocket" size={18} /> شروع در مرورگر
            </Link>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row items-center lg:justify-start justify-center gap-x-4 gap-y-2 secondary text-[13px] animate-fade-up [animation-delay:320ms]">
            <span className="inline-flex items-center gap-1.5">
              <AppIcon name="check" size={15} className="text-ios-green" /> نصب در کمتر از یک دقیقه
            </span>
            <span className="inline-flex items-center gap-1.5">
              <AppIcon name="check" size={15} className="text-ios-green" /> شروعِ رایگان، بدونِ کارت بانکی
            </span>
            <span className="inline-flex items-center gap-1.5">
              <AppIcon name="check" size={15} className="text-ios-green" /> ورودِ بی‌رمز با پسکی
            </span>
          </div>
        </div>

        <div className="lg:col-span-5 animate-fade-up [animation-delay:200ms]">
          <HeroPreview />
        </div>
      </div>
    </section>
  );
}

/** کارتِ پیش‌نمایشِ اپ — با همان زبانِ بصریِ خودِ «امروز». */
function HeroPreview() {
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="absolute -inset-7 -z-10 rounded-[52px] blur-3xl opacity-60"
        style={{ background: "linear-gradient(135deg,#8267f2,#6a8bff 50%,#2cb8cf)" }} />

      <div className="float-card p-6 rotate-[-2.4deg]">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="secondary text-[13px]">امروز</p>
            <p className="text-[20px] font-extrabold tracking-tight">رأی‌های امروزت</p>
          </div>
          <span className="chip !bg-ios-orange/15 text-ios-orange font-bold">
            <AppIcon name="flame" size={15} /> ۱۲ روز پیاپی
          </span>
        </div>

        <div className="flex items-center justify-center py-2">
          <Ring progress={0.74} size={150} stroke={14} color="#8267f2">
            <span className="font-display text-[44px] font-bold leading-none">۷۴٪</span>
            <span className="secondary text-[12px] mt-1">۷ از ۹ کار</span>
          </Ring>
        </div>

        <div className="mt-4 space-y-2.5">
          <MiniRow icon="strength" color="#a96ff0" label="ورزشِ امروز" done />
          <MiniRow icon="water" color="#2cb8cf" label="۸ لیوان آب" done />
          <MiniRow icon="study" color="#5b76f0" label="۳۰ دقیقه مطالعه" />
        </div>
      </div>

      {/* بَجِ شناورِ کالری */}
      <div className="float-card absolute -bottom-6 -left-4 sm:-left-9 p-4 rotate-[3.5deg] w-44 hidden sm:block">
        <div className="flex items-center gap-2.5">
          <span className="h-10 w-10 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: "#fb9a5b22", color: "#fb9a5b" }}>
            <AppIcon name="flame" size={20} />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] secondary">کالریِ امروز</p>
            <p className="font-display text-[20px] font-bold leading-none mt-0.5">۱٬۸۴۰</p>
          </div>
        </div>
      </div>

      {/* بَجِ شناورِ رشد */}
      <div className="float-card absolute -top-4 -right-3 sm:-right-7 px-4 py-2.5 -rotate-[4deg] hidden sm:flex items-center gap-2">
        <AppIcon name="chart" size={18} className="text-ios-green" />
        <span className="font-display text-[18px] font-bold leading-none">۳۷٫۸×</span>
        <span className="secondary text-[12px]">اگر هر روز ۱٪</span>
      </div>
    </div>
  );
}

function MiniRow({ icon, color, label, done }: { icon: string; color: string; label: string; done?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-[18px] px-3 py-2.5"
      style={{ background: "color-mix(in srgb, var(--card-solid) 50%, transparent)" }}>
      <span className="h-9 w-9 rounded-[13px] flex items-center justify-center shrink-0"
        style={{ background: color + "22", color }}>
        <AppIcon name={icon} size={18} />
      </span>
      <span className="flex-1 text-[15px] font-semibold">{label}</span>
      <span className={`h-6 w-6 rounded-full flex items-center justify-center ${done ? "text-white" : "secondary border border-[var(--border)]"}`}
        style={done ? { background: "#22c391" } : undefined}>
        {done && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
      </span>
    </div>
  );
}

/* نوارِ آمار (دفترِ کل) ──────────────────────────────────── */

function LedgerStrip() {
  return (
    <section className="mx-auto max-w-6xl px-5 sm:px-8 py-6">
      <Reveal>
        <div className="card !rounded-ios grid grid-cols-2 md:grid-cols-4 divide-x divide-x-reverse divide-[var(--sep)]">
          {LEDGER_STATS.map((s) => (
            <div key={s.label} className="px-6 py-7 text-center">
              <p className="font-display text-[40px] sm:text-[52px] font-bold leading-none grad-text">{s.value}</p>
              <p className="secondary text-[14px] mt-2">{s.label}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

/* رشدِ مرکب ──────────────────────────────────────────────── */

function Compound() {
  return (
    <section id="compound" className="mx-auto max-w-6xl px-5 sm:px-8 py-16 sm:py-24">
      <Reveal>
        <div className="card !rounded-ios-lg p-8 sm:p-12 relative overflow-hidden">
          <div className="absolute inset-0 -z-0 opacity-60" style={ledger} aria-hidden />
          <div className="relative grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-ios-indigo font-bold text-[15px] mb-3">ریاضیِ سادهٔ پیشرفت</p>
              <h2 className="font-display text-[40px] sm:text-[56px] font-bold leading-[0.98] tracking-tight">
                یک‌درصد، هر روز،
                <br />
                تو را{" "}
                <span className="grad-text">
                  <CountUp to={37.8} decimals={1} />×
                </span>{" "}
                می‌کند.
              </h2>
              <p className="secondary text-[17px] leading-9 mt-5 max-w-md">
                این وعدهٔ تبلیغاتی نیست؛ ریاضی است: ۱٫۰۱ به توانِ ۳۶۵ می‌شود ۳۷٫۸. هر روز فقط
                یک‌درصد بهتر شوی، پایانِ سال ۳۷٫۸ برابرِ امروزت هستی — و هر روز یک‌درصد بدتر،
                تقریباً صفر. تمامِ کارِ «امروز» نگه‌داشتنِ همان یک‌درصدِ روزانه است.
              </p>

              <div className="mt-7 grid grid-cols-2 gap-3 max-w-md">
                <StatBox color="#f56178" sign="−" label="۱٪ بدتر، هر روز" value="۰٫۰۳" foot="در پایانِ سال" />
                <StatBox color="#22c391" sign="+" label="۱٪ بهتر، هر روز" value="۳۷٫۸" foot="در پایانِ سال" highlight />
              </div>
            </div>

            <div className="relative">
              <CompoundChart />
            </div>
          </div>

          {/* شبکهٔ ۳۶۵ روز — هر مربع، یک روز */}
          <div className="relative mt-12 pt-9 border-t border-[var(--sep)]">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <p className="text-[17px] font-bold">یک سال، روز‌به‌روز</p>
              <p className="secondary text-[14px]">هر مربع یک روز است · هر روز یک رأی</p>
            </div>
            <YearGrid />
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function StatBox({ color, sign, label, value, foot, highlight }: {
  color: string; sign: string; label: string; value: string; foot: string; highlight?: boolean;
}) {
  return (
    <div className="rounded-[22px] p-4 border"
      style={{
        borderColor: highlight ? color + "55" : "var(--border)",
        background: highlight ? color + "12" : "color-mix(in srgb, var(--card-solid) 45%, transparent)",
      }}>
      <p className="secondary text-[13px]">{label}</p>
      <p className="font-display text-[34px] font-bold tracking-tight mt-1 leading-none" style={{ color }}>
        <span className="text-[20px] align-middle">{sign}</span> ×{value}
      </p>
      <p className="secondary text-[12px] mt-1.5">{foot}</p>
    </div>
  );
}

/** منحنیِ رشدِ مرکب که با ورود به دید رسم می‌شود. */
function CompoundChart() {
  const [shown, setShown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setShown(true); io.disconnect(); }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const W = 320, H = 210, pad = 10;
  const pts: string[] = [];
  const N = 60;
  for (let i = 0; i <= N; i++) {
    const x = (i / N) * 365;
    const y = Math.pow(1.01, x);
    const px = pad + (i / N) * (W - pad * 2);
    const py = H - pad - ((y - 1) / (37.8 - 1)) * (H - pad * 2);
    pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
  }
  const line = pts.join(" ");
  const area = `${pad},${H - pad} ${line} ${W - pad},${H - pad}`;

  return (
    <div ref={ref} className="mx-auto w-full max-w-[380px]">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto overflow-visible">
        <defs>
          <linearGradient id="cg" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#6a8bff" />
            <stop offset="0.55" stopColor="#8267f2" />
            <stop offset="1" stopColor="#a96ff0" />
          </linearGradient>
          <linearGradient id="cgFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8267f2" stopOpacity="0.28" />
            <stop offset="1" stopColor="#8267f2" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1={pad} x2={W - pad} y1={pad + g * (H - pad * 2)} y2={pad + g * (H - pad * 2)}
            stroke="var(--sep)" strokeWidth="1" />
        ))}
        <polygon points={area} fill="url(#cgFill)"
          style={{ opacity: shown ? 1 : 0, transition: "opacity 1.1s ease 0.3s" }} />
        <polyline points={line} fill="none" stroke="url(#cg)" strokeWidth="3.5"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ strokeDasharray: 1500, strokeDashoffset: shown ? 0 : 1500, transition: "stroke-dashoffset 1.7s cubic-bezier(0.16,1,0.3,1)" }} />
        <circle cx={W - pad} cy={pad} r="6.5" fill="#a96ff0"
          style={{ opacity: shown ? 1 : 0, transition: "opacity 0.4s ease 1.6s" }} />
      </svg>
      <div className="flex items-center justify-between secondary text-[12px] px-2 mt-1">
        <span>روزِ ۳۶۵</span>
        <span>روزِ ۱</span>
      </div>
    </div>
  );
}

/** شبکهٔ ۳۶۵ مربع که هنگامِ ورود به دید، روز‌به‌روز روشن می‌شود. */
function YearGrid() {
  const [shown, setShown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setShown(true); io.disconnect(); }
    }, { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="grid gap-[3px]" style={{ gridTemplateColumns: "repeat(28, minmax(0, 1fr))" }}>
      {Array.from({ length: 365 }).map((_, i) => {
        // هر روز کمی پررنگ‌تر از دیروز — شدتِ رنگ، خودِ رشدِ مرکب است
        const ramp = 0.28 + 0.72 * (i / 364);
        return (
          <span
            key={i}
            className="aspect-square rounded-[2px]"
            style={{
              background: shown
                ? "linear-gradient(135deg,#6a8bff,#8267f2)"
                : "color-mix(in srgb, var(--label) 8%, transparent)",
              opacity: shown ? ramp : 1,
              transform: shown ? "scale(1)" : "scale(0.6)",
              transition: `opacity .5s ease ${Math.min(i * 3.4, 1500)}ms, transform .45s ease ${Math.min(i * 3.4, 1500)}ms`,
            }}
          />
        );
      })}
    </div>
  );
}

/* قابلیت‌ها — بِنتو ───────────────────────────────────────── */

function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-5 sm:px-8 py-12 sm:py-16">
      <SectionHead
        eyebrow="یک اپ، به‌جای ده‌تا"
        title="هر چیزی که برای رشد لازم داری"
        sub="همه‌ی ابزارها زیرِ یک سقفِ آرام و یک‌دست — تا تمرکزت روی پیشرفت بماند، نه روی شلوغی."
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 auto-rows-[1fr] gap-4 mt-10">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={(i % 4) * 60} className={i === 0 ? "sm:col-span-2 lg:row-span-2" : ""}>
            <FeatureCard f={f} large={i === 0} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function FeatureCard({ f, large }: { f: Feature; large?: boolean }) {
  if (large) {
    return (
      <div className="card h-full p-7 sm:p-9 flex flex-col justify-between relative overflow-hidden group">
        <div className="absolute -bottom-10 -left-10 h-44 w-44 rounded-full blur-3xl opacity-50 transition-opacity duration-500 group-hover:opacity-80"
          style={{ background: f.color }} aria-hidden />
        <div className="relative">
          <span className="h-14 w-14 rounded-[20px] flex items-center justify-center mb-6"
            style={{ background: f.color + "1f", color: f.color }}>
            <AppIcon name={f.icon} size={28} />
          </span>
          <h3 className="font-display text-[30px] sm:text-[36px] font-bold leading-none">{f.title}</h3>
          <p className="secondary text-[16px] leading-8 mt-3 max-w-sm">{f.desc}</p>
        </div>
        <p className="relative text-ios-indigo text-[14px] font-semibold mt-6">قلبِ «امروز» ↙</p>
      </div>
    );
  }
  return (
    <div className="card h-full p-5 hover:-translate-y-1 transition-transform duration-300">
      <span className="h-12 w-12 rounded-[18px] flex items-center justify-center mb-4"
        style={{ background: f.color + "1f", color: f.color }}>
        <AppIcon name={f.icon} size={24} />
      </span>
      <h3 className="text-[18px] font-bold tracking-tight">{f.title}</h3>
      <p className="secondary text-[14px] leading-7 mt-1.5">{f.desc}</p>
    </div>
  );
}

/* مربیِ هوشمند ───────────────────────────────────────────── */

function Coach() {
  return (
    <section id="coach" className="mx-auto max-w-6xl px-5 sm:px-8 py-12 sm:py-16">
      <Reveal>
        <div className="relative overflow-hidden rounded-ios-lg p-8 sm:p-12 text-white shadow-float"
          style={{ backgroundImage: "linear-gradient(135deg,#5b76f0 0%,#8267f2 55%,#a96ff0 100%)" }}>
          <div aria-hidden className="absolute inset-0 opacity-[0.14]" style={{ ...ledger, backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1.5px)" }} />
          <div aria-hidden className="absolute -top-16 -left-16 h-64 w-64 rounded-full bg-white/15 blur-3xl" />
          <div aria-hidden className="absolute -bottom-20 right-1/4 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="relative grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3.5 py-1.5 text-[13px] font-semibold">
                <AppIcon name="sparkles" size={15} /> هوش مصنوعی
              </span>
              <h2 className="font-display text-[40px] sm:text-[54px] font-bold leading-[0.98] mt-5">
                آشنا شو: «جوانه»
              </h2>
              <p className="text-[17px] leading-9 mt-4 text-white/90 max-w-md">
                جوانه مربیِ هوشمندِ «امروز» است. صبح با یک بریفینگِ کوتاه روزت را می‌چیند،
                وقتی گیر می‌کنی پای حرفت می‌نشیند و آخرِ هفته نشانت می‌دهد کجای مسیری.
                نه قضاوت می‌کند، نه سرزنش — فقط قدمِ بعدی.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {COACH_POINTS.map((p) => (
                <div key={p.text} className="flex items-center gap-3 rounded-[20px] bg-white/15 backdrop-blur-sm px-4 py-3.5 border border-white/15">
                  <span className="h-10 w-10 rounded-[14px] bg-white/20 flex items-center justify-center shrink-0">
                    <AppIcon name={p.icon} size={20} />
                  </span>
                  <span className="text-[15px] font-semibold leading-tight">{p.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* چطور کار می‌کند ────────────────────────────────────────── */

function Steps() {
  return (
    <section id="how" className="mx-auto max-w-6xl px-5 sm:px-8 py-12 sm:py-16">
      <SectionHead
        eyebrow="در سه قدم"
        title="شروع کردن ساده است"
        sub="بدونِ پیچیدگی. از همان دقیقهٔ اول، اولین رأیت را به آدمی که می‌خواهی بشوی بده."
      />
      <div className="grid md:grid-cols-3 gap-5 mt-10">
        {STEPS.map((s, i) => (
          <Reveal key={s.title} delay={i * 90}>
            <div className="card h-full p-7 relative overflow-hidden">
              <span className="font-display absolute top-3 left-5 text-[68px] font-bold leading-none opacity-10">
                {faNum(`0${i + 1}`)}
              </span>
              <div className="relative">
                <span className="h-14 w-14 rounded-[20px] flex items-center justify-center text-white shadow-card mb-5"
                  style={{ background: `linear-gradient(135deg, ${s.color}, ${s.color}cc)` }}>
                  <AppIcon name={s.icon} size={26} />
                </span>
                <h3 className="text-[20px] font-bold tracking-tight">{s.title}</h3>
                <p className="secondary text-[15px] leading-7 mt-2">{s.desc}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* حریمِ خصوصی ────────────────────────────────────────────── */

function Privacy() {
  return (
    <section className="mx-auto max-w-6xl px-5 sm:px-8 py-12 sm:py-16">
      <Reveal>
        <div className="card !rounded-ios-lg p-8 sm:p-10 flex flex-col sm:flex-row items-center gap-7 text-center sm:text-right">
          <span className="h-20 w-20 rounded-[26px] shrink-0 flex items-center justify-center text-white shadow-glow"
            style={{ background: "linear-gradient(135deg,#8267f2,#5b76f0)" }}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5l-8-3Z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </span>
          <div className="flex-1">
            <h2 className="font-display text-[28px] sm:text-[34px] font-bold tracking-tight leading-none">بی‌رمز، خصوصی و امن</h2>
            <p className="secondary text-[16px] leading-8 mt-3">
              ورود فقط با پسکی است — Face ID، Touch ID یا پینِ دستگاهت. هیچ رمزی برای فراموش‌کردن
              یا لو‌رفتن وجود ندارد و داده‌هایت خصوصی روی حسابِ خودت می‌ماند.
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* دعوتِ پایانی ───────────────────────────────────────────── */

function FinalCTA() {
  return (
    <section className="mx-auto max-w-6xl px-5 sm:px-8 pt-8 pb-20 sm:pb-28">
      <Reveal>
        <div className="relative overflow-hidden rounded-ios-lg p-10 sm:p-16 text-center text-white shadow-float"
          style={{ backgroundImage: "linear-gradient(135deg,#6a8bff 0%,#8267f2 50%,#a96ff0 100%)" }}>
          <div aria-hidden className="absolute inset-0 opacity-[0.14]" style={{ ...ledger, backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1.5px)" }} />
          <div aria-hidden className="absolute -top-24 left-1/3 h-72 w-72 rounded-full bg-white/15 blur-3xl" />
          <div className="relative">
            <span className="inline-flex h-16 w-16 rounded-[24px] bg-white/15 items-center justify-center mb-6 animate-float">
              <Logo size={34} />
            </span>
            <h2 className="font-display text-[44px] sm:text-[64px] font-bold tracking-tight leading-[0.95]">
              همین امروز، اولین قدمت را بردار
            </h2>
            <p className="text-[17px] sm:text-[19px] text-white/90 mt-4 max-w-lg mx-auto leading-9">
              بهترین روزِ شروع، همین امروز است. کمتر از یک دقیقه تا اولین رأی به آدمی که می‌خواهی بشوی.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <InstallButton tone="white" className="text-[17px] !px-7 shadow-lg">
                <AppIcon name="download" size={19} /> نصبِ رایگانِ اپ
              </InstallButton>
              <Link href="/login" className="text-white font-semibold text-[15px] underline-offset-4 hover:underline active:opacity-70">
                یا شروع در مرورگر ←
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* فوتر ───────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="relative border-t border-[var(--border)] glass">
      <div className="mx-auto max-w-6xl px-5 sm:px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-5">
        <div className="flex items-center gap-2.5">
          <span className="h-9 w-9 rounded-[14px] bg-gradient-to-br from-[#6a8bff] via-ios-indigo to-ios-purple flex items-center justify-center">
            <Logo size={20} />
          </span>
          <div>
            <p className="font-display font-bold grad-text text-[22px] leading-none">{BRAND}</p>
            <p className="secondary text-[12px] mt-1">{SLOGAN}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <a
            referrerPolicy="origin"
            target="_blank"
            href="https://trustseal.enamad.ir/?id=739117&Code=iHDIuHOAA4wcM5Fvi1MUBcyxBQ3BdvuU"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              referrerPolicy="origin"
              src="https://trustseal.enamad.ir/logo.aspx?id=739117&Code=iHDIuHOAA4wcM5Fvi1MUBcyxBQ3BdvuU"
              alt="اینماد"
              style={{ cursor: "pointer", height: 48 }}
              // @ts-expect-error enamad custom attribute
              code="iHDIuHOAA4wcM5Fvi1MUBcyxBQ3BdvuU"
            />
          </a>
          <Link href="/login" className="text-ios-blue text-[15px] font-semibold active:opacity-60">
            ورود / ثبت‌نام
          </Link>
        </div>
      </div>
      <p className="secondary text-center text-[12px] pb-8">
        ساخته‌شده برای کسانی که می‌خواهند هر روز کمی بهتر شوند.
      </p>
    </footer>
  );
}

/* اجزای کمکی ─────────────────────────────────────────────── */

function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) {
  return (
    <Reveal className="text-center max-w-2xl mx-auto">
      <p className="text-ios-indigo font-bold text-[15px] mb-2">{eyebrow}</p>
      <h2 className="font-display text-[40px] sm:text-[54px] font-bold tracking-tight leading-[0.98]">{title}</h2>
      <p className="secondary text-[17px] leading-8 mt-4">{sub}</p>
    </Reveal>
  );
}

/** شمارندهٔ نرم که با ورود به دید بالا می‌رود. */
function CountUp({ to, decimals = 0, className }: { to: number; decimals?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [v, setV] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        const dur = 1500, t0 = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - t0) / dur);
          const eased = 1 - Math.pow(1 - p, 3);
          setV(to * eased);
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        io.disconnect();
      }
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [to]);

  return <span ref={ref} className={className}>{faNum(v.toFixed(decimals))}</span>;
}

/** نمایان‌شدنِ نرم هنگامِ ورود به دید. */
function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setShown(true); return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setShown(true); io.disconnect(); }
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : "translateY(24px)",
        transition: `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/** برچسبِ عمودیِ کناری — جزئیاتِ مجله‌ای. */
function SideTag() {
  return (
    <div aria-hidden className="hidden lg:flex fixed right-3 top-1/2 -translate-y-1/2 z-30 items-center gap-3 secondary text-[12px] font-medium tracking-widest"
      style={{ writingMode: "vertical-rl" }}>
      <span className="h-12 w-px bg-[var(--sep)]" />
      ۱٪ · هر روز · {BRAND}
      <span className="h-12 w-px bg-[var(--sep)]" />
    </div>
  );
}

/** هاله‌های گرادیانیِ پس‌زمینه برای عمقِ رؤیایی. */
function Aurora() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-32 -right-24 h-[28rem] w-[28rem] rounded-full blur-3xl opacity-40 animate-float"
        style={{ background: "linear-gradient(135deg,#8267f2,#6a8bff)" }} />
      <div className="absolute top-1/2 -left-32 h-[24rem] w-[24rem] rounded-full blur-3xl opacity-30 animate-float"
        style={{ background: "linear-gradient(135deg,#2cb8cf,#6a8bff)", animationDelay: "-2.5s" }} />
      <div className="absolute bottom-0 right-1/4 h-[26rem] w-[26rem] rounded-full blur-3xl opacity-25 animate-float"
        style={{ background: "linear-gradient(135deg,#fb7fa0,#fb9a5b)", animationDelay: "-4.5s" }} />
    </div>
  );
}

/** لایهٔ دانه‌دانه (grain) برای بافتِ کاغذی. */
function Grain() {
  const svg =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-[9] opacity-[0.045] mix-blend-soft-light"
      style={{ backgroundImage: `url("${svg}")` }} />
  );
}

/* دکمهٔ هوشمندِ نصب ───────────────────────────────────────────
   اندروید/کروم: نصبِ یک‌ضربه‌ای. آی‌اواس و بقیه: راهنمای «افزودن به
   صفحهٔ خانه». اگر از قبل نصب است: دکمه به بازکردنِ اپ تبدیل می‌شود. */

function InstallButton({
  children,
  tone = "gradient",
  className = "",
}: {
  children: ReactNode;
  tone?: "gradient" | "white" | "ghost";
  className?: string;
}) {
  const { canPrompt, installed, platform, promptInstall } = useInstall();
  const [helpOpen, setHelpOpen] = useState(false);

  const base = "inline-flex items-center justify-center gap-2 font-bold transition active:scale-[0.97]";
  const toneCls =
    tone === "white"
      ? "rounded-[20px] bg-white text-ios-indigo px-5 py-3.5"
      : tone === "ghost"
      ? "ios-btn-ghost"
      : "ios-btn-primary";

  if (installed) {
    return (
      <Link href="/login" className={`${base} ${toneCls} ${className}`}>
        <AppIcon name="check" size={18} /> اپ نصب است — بازش کن
      </Link>
    );
  }

  const onClick = async () => {
    if (canPrompt) {
      await promptInstall();
      return;
    }
    setHelpOpen(true);
  };

  return (
    <>
      <button type="button" onClick={onClick} className={`${base} ${toneCls} ${className}`}>
        {children}
      </button>
      {helpOpen && <InstallHelp platform={platform} onClose={() => setHelpOpen(false)} />}
    </>
  );
}

/** راهنمای نصبِ دستی برای آی‌اواس و مرورگرهایی که نصبِ خودکار ندارند. */
function InstallHelp({ platform, onClose }: { platform: Platform; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const steps =
    platform === "ios"
      ? [
          { icon: "share", text: "دکمهٔ هم‌رسانی (Share) را در نوارِ سافاری بزن." },
          { icon: "plus", text: "«افزودن به صفحهٔ خانه» (Add to Home Screen) را انتخاب کن." },
          { icon: "check", text: "روی «افزودن» بزن — اپ روی صفحهٔ خانه می‌نشیند." },
        ]
      : [
          { icon: "phone", text: "منوی مرورگر (⋮) را باز کن." },
          { icon: "download", text: "«نصبِ برنامه» یا «افزودن به صفحهٔ خانه» را بزن." },
          { icon: "check", text: "تأیید کن — تمام! اپ مثلِ یک برنامهٔ واقعی باز می‌شود." },
        ];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div aria-hidden className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="card !rounded-ios-lg relative w-full max-w-md p-7 animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-5">
          <span
            className="h-12 w-12 rounded-[18px] flex items-center justify-center text-white shadow-glow shrink-0"
            style={{ background: "linear-gradient(135deg,#8267f2,#5b76f0)" }}
          >
            <AppIcon name="phone" size={24} />
          </span>
          <div>
            <h3 className="font-display text-[24px] font-bold leading-none">نصبِ «{BRAND}»</h3>
            <p className="secondary text-[13px] mt-1.5">
              {platform === "ios" ? "روی آیفون و آیپد، در سافاری" : "در سه قدمِ کوتاه"}
            </p>
          </div>
        </div>

        <ol className="space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="flex items-center gap-3 rounded-[18px] px-3.5 py-3"
              style={{ background: "color-mix(in srgb, var(--card-solid) 50%, transparent)" }}>
              <span className="font-display h-8 w-8 rounded-full bg-ios-indigo/12 text-ios-indigo font-bold flex items-center justify-center shrink-0 text-[15px]">
                {faNum(i + 1)}
              </span>
              <AppIcon name={s.icon} size={20} className="text-ios-indigo shrink-0" />
              <span className="text-[15px] font-semibold leading-tight">{s.text}</span>
            </li>
          ))}
        </ol>

        <div className="mt-6 flex items-center justify-between gap-3">
          <Link href="/login" className="text-ios-blue text-[15px] font-semibold active:opacity-60">
            فعلاً در مرورگر شروع کن ←
          </Link>
          <button type="button" onClick={onClose} className="ios-btn-ghost !py-2.5 !px-5 text-[15px]">
            باشه، فهمیدم
          </button>
        </div>
      </div>
    </div>
  );
}

/* بخشِ نصب ───────────────────────────────────────────────── */

const INSTALL_STEPS: { icon: string; title: string; desc: string; color: string }[] = [
  { icon: "download", color: "#5b76f0", title: "«نصب» را بزن", desc: "یک ضربه روی اندروید و کروم؛ روی آیفون از «افزودن به صفحهٔ خانه»." },
  { icon: "phone", color: "#8267f2", title: "روی صفحهٔ خانه می‌نشیند", desc: "مثلِ یک اپِ واقعی — تمام‌صفحه، سریع و بدونِ نوارِ مرورگر." },
  { icon: "vote", color: "#22c391", title: "اولین قدمت را بردار", desc: "با Face ID یا Touch ID وارد شو و همین امروز شروع کن." },
];

function Install() {
  return (
    <section id="install" className="mx-auto max-w-6xl px-5 sm:px-8 py-12 sm:py-16">
      <Reveal>
        <div className="card !rounded-ios-lg p-8 sm:p-12 relative overflow-hidden">
          <div className="absolute inset-0 -z-0 opacity-60" style={ledger} aria-hidden />
          <div aria-hidden className="absolute -top-16 -left-16 h-56 w-56 rounded-full blur-3xl opacity-40"
            style={{ background: "linear-gradient(135deg,#8267f2,#6a8bff)" }} />
          <div className="relative grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            <div className="text-center lg:text-right">
              <p className="text-ios-indigo font-bold text-[15px] mb-3">روی گوشی، همیشه دمِ دست</p>
              <h2 className="font-display text-[40px] sm:text-[54px] font-bold leading-[0.98] tracking-tight">
                «{BRAND}» را روی گوشی‌ات نصب کن
              </h2>
              <p className="secondary text-[17px] leading-9 mt-5 max-w-md mx-auto lg:mx-0">
                نه اپ‌استور لازم است، نه دانلودِ سنگین. یک ضربه و اپ روی صفحهٔ خانه‌ات می‌نشیند —
                تا قدمِ هر روزه، فقط یک لمس فاصله داشته باشد.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center lg:justify-start justify-center gap-3">
                <InstallButton tone="gradient" className="w-full sm:w-auto shadow-glow text-[17px] !px-7">
                  <AppIcon name="download" size={20} /> همین حالا نصب کن
                </InstallButton>
                <Link href="/login" className="ios-btn-ghost w-full sm:w-auto flex items-center justify-center gap-2 active:scale-[0.97]">
                  <AppIcon name="rocket" size={18} /> شروع در مرورگر
                </Link>
              </div>
              <p className="secondary text-[13px] mt-4">
                <AppIcon name="check" size={14} className="text-ios-green inline align-[-2px] ms-1" />
                رایگان · بدونِ کارت بانکی · کار روی آیفون، اندروید و دسکتاپ
              </p>
            </div>

            <ol className="space-y-3.5">
              {INSTALL_STEPS.map((s, i) => (
                <li key={s.title} className="flex items-center gap-4 rounded-[22px] p-4 border"
                  style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--card-solid) 45%, transparent)" }}>
                  <span className="relative h-12 w-12 rounded-[16px] flex items-center justify-center text-white shrink-0 shadow-card"
                    style={{ background: `linear-gradient(135deg, ${s.color}, ${s.color}cc)` }}>
                    <AppIcon name={s.icon} size={22} />
                    <span className="font-display absolute -top-2 -right-2 h-6 w-6 rounded-full bg-[var(--card-solid)] text-[var(--label)] text-[13px] font-bold flex items-center justify-center shadow-card">
                      {faNum(i + 1)}
                    </span>
                  </span>
                  <div className="min-w-0">
                    <p className="text-[17px] font-bold tracking-tight">{s.title}</p>
                    <p className="secondary text-[14px] leading-7 mt-0.5">{s.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* پرسش‌های پرتکرار ─────────────────────────────────────────── */

const FAQS: { q: string; a: string }[] = [
  { q: "چقدر طول می‌کشد تا شروع کنم؟", a: "کمتر از یک دقیقه. اپ را نصب کن، با Face ID یا Touch ID وارد شو و همان لحظه اولین رأیت را به آدمی که می‌خواهی بشوی بده." },
  { q: "رایگان است؟", a: "ثبت و پیگیریِ روزانه — عادت‌ها، کالری، بودجه و سلامتی — برای همیشه رایگان است و کارت بانکی هم نمی‌خواهد. گفتگو با جوانه روزی ۵ بار رایگان است؛ اگر بیشتر خواستی، اشتراکِ پلاس و پرو هست." },
  { q: "حتماً باید نصبش کنم یا در مرورگر هم کار می‌کند؟", a: "هر دو. در مرورگر هم کامل کار می‌کند؛ اما نسخهٔ نصب‌شده تمام‌صفحه و سریع‌تر است و یادآوری‌ها بهتر به دستت می‌رسد." },
  { q: "روی آیفون هم نصب می‌شود؟", a: "بله. در سافاری دکمهٔ هم‌رسانی را بزن و «افزودن به صفحهٔ خانه» را انتخاب کن — اپ مثلِ یک برنامهٔ واقعی باز می‌شود." },
  { q: "داده‌هایم امن است؟", a: "ورود فقط با پسکی است؛ هیچ رمزی برای لو‌رفتن وجود ندارد و داده‌هایت خصوصی روی حسابِ خودت می‌ماند." },
  { q: "اگر یک روز را جا انداختم چه؟", a: "اشکالی ندارد. هدف، کمال نیست؛ تداوم است. مهم این است که فردا دوباره برگردی و یک رأیِ کوچکِ دیگر بدهی." },
];

function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-5 sm:px-8 py-12 sm:py-16">
      <SectionHead
        eyebrow="هر چه باید بدانی"
        title="پرسش‌های پرتکرار"
        sub="اگر هنوز شک داری، احتمالاً جوابت همین‌جاست."
      />
      <div className="mt-10 space-y-3">
        {FAQS.map((f, i) => (
          <Reveal key={f.q} delay={(i % 3) * 60}>
            <details className="card group p-0 overflow-hidden">
              <summary className="flex items-center justify-between gap-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden px-5 sm:px-6 py-4 select-none">
                <span className="text-[16px] sm:text-[17px] font-bold leading-tight">{f.q}</span>
                <span className="h-7 w-7 rounded-full bg-ios-indigo/12 text-ios-indigo flex items-center justify-center shrink-0 transition-transform duration-300 group-open:rotate-45">
                  <AppIcon name="plus" size={17} />
                </span>
              </summary>
              <p className="secondary text-[15px] leading-8 px-5 sm:px-6 pb-5 -mt-1">{f.a}</p>
            </details>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
