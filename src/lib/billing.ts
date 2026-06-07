import type { getServiceClient } from "@/lib/supabase";

type DB = ReturnType<typeof getServiceClient>;

/** تعداد فراخوانیِ رایگانِ هوش مصنوعی در هر روز (پی‌وال). */
export const FREE_DAILY = 5;

/** سقفِ سختِ ضدِسوءاستفاده در هر دقیقه برای هر کاربر (محافظت). */
export const ABUSE_PER_MIN = 20;

/**
 * هزینهٔ هر سرویسِ هوش مصنوعی بر حسبِ اعتبار.
 * پیش‌فرض ۱؛ سرویس‌های سنگین‌تر (vision یا تحلیلِ بلند) ۲.
 */
export const COST: Record<string, number> = {
  coach_chat: 1,
  coach_briefing: 1,
  coach_invest: 1,
  coach_parse: 1,
  coach_nutrition: 2,
  coach_workout: 2,
  coach_weekly: 2,
  meal_estimate: 2,
  meal_report: 2,
  mission_generate: 1,
};

export function costOf(endpoint: string): number {
  return COST[endpoint] ?? 1;
}

/**
 * پلن‌های اشتراک. تره‌کینگ (کالری/بودجه/عادت) همیشه رایگان است؛
 * این پلن‌ها فقط هوشِ مربی «جوانه» را باز می‌کنند.
 */
export type Plan = {
  id: "free" | "plus" | "pro";
  name: string;
  tagline: string;
  /** قیمتِ ماهانه به تومان (۰ برای رایگان). */
  priceMonthly: number;
  /** سهمیه‌ی اعتبارِ ماهانه‌ی هوش مصنوعی (رایگان از FREE_DAILY استفاده می‌کند). */
  monthlyCredits: number;
  features: string[];
  /** «پیشنهاد ما» — کارتِ هایلایت‌شده. */
  highlight?: boolean;
};

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "رایگان",
    tagline: "برای شروع و ساختنِ عادت",
    priceMonthly: 0,
    monthlyCredits: 0,
    features: [
      "ثبتِ نامحدودِ کالری، بودجه، آب و عادت",
      "۵ گفتگو با جوانه در روز",
      "یادآوریِ روزانه",
    ],
  },
  {
    id: "plus",
    name: "پلاس",
    tagline: "همراهِ هر روزت",
    priceMonthly: 89_000,
    monthlyCredits: 500,
    features: [
      "هرچی توی رایگان هست",
      "گفتگوی نامحدود با جوانه",
      "۵ تحلیلِ سنگین در روز (عکسِ غذا، برنامه‌ی تمرین و تغذیه)",
      "مرورِ هفتگی",
    ],
    highlight: true,
  },
  {
    id: "pro",
    name: "پرو",
    tagline: "بدونِ هیچ مرزی",
    priceMonthly: 159_000,
    monthlyCredits: 1500,
    features: [
      "هرچی توی پلاس هست",
      "همه‌چیز نامحدود",
      "مشاورِ سرمایه‌گذاری",
      "اولویت در پاسخ",
    ],
  },
];

export type BillingCycle = "monthly" | "annual";

/** قیمتِ سالانه = ۱۰ برابرِ ماهانه (۲ ماه هدیه). */
export function annualPrice(monthly: number): number {
  return monthly * 10;
}

/**
 * بسته‌های قابلِ خرید که از پلن‌ها ساخته می‌شوند تا فلوی پرداختِ فعلی
 * (تک‌مرحله‌ای) بدون تغییر کار کند. شناسه: `<plan>-<cycle>`.
 */
export type Pack = { id: string; toman: number; credits: number; label: string };
export const PACKS: Pack[] = PLANS.filter((p) => p.priceMonthly > 0).flatMap((p) => [
  { id: `${p.id}-monthly`, toman: p.priceMonthly, credits: p.monthlyCredits, label: `${p.name} ماهانه` },
  { id: `${p.id}-annual`, toman: annualPrice(p.priceMonthly), credits: p.monthlyCredits * 12, label: `${p.name} سالانه` },
]);

export function findPack(id: string): Pack | undefined {
  return PACKS.find((p) => p.id === id);
}

/** شناسه‌ی بسته `<plan>-<cycle>` را تجزیه می‌کند. */
export function parsePackId(id: string): { plan: string; cycle: BillingCycle } | null {
  const [plan, cycle] = id.split("-");
  if (!plan || (cycle !== "monthly" && cycle !== "annual")) return null;
  return { plan, cycle };
}

/** تعدادِ روزِ هر دوره. */
export function planDays(cycle: BillingCycle): number {
  return cycle === "annual" ? 365 : 30;
}

/** اندپوینتِ «سنگین» = هزینه‌ی ۲ به بالا (vision/تحلیلِ بلند). */
export const HEAVY_ENDPOINTS: string[] = Object.entries(COST)
  .filter(([, c]) => c >= 2)
  .map(([k]) => k);

export function isHeavy(endpoint: string): boolean {
  return costOf(endpoint) >= 2;
}

/** سقفِ تحلیلِ سنگین در روز برای هر پلن (سبک‌ها نامحدودند). */
export const HEAVY_DAILY: Record<string, number> = { plus: 5, pro: 100_000 };

export type ActiveSub = { plan: string; cycle: BillingCycle; expiresAt: string } | null;

/** اشتراکِ فعالِ کاربر (اگر منقضی شده یا نبود، null برمی‌گرداند). */
export async function getActiveSubscription(db: DB, uid: string): Promise<ActiveSub> {
  const { data } = await db
    .from("subscriptions")
    .select("plan, cycle, expires_at")
    .eq("user_id", uid)
    .maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at as string).getTime() <= Date.now()) return null;
  return {
    plan: data.plan as string,
    cycle: data.cycle as BillingCycle,
    expiresAt: data.expires_at as string,
  };
}

/** فعال‌سازی/تمدیدِ اتمیکِ اشتراک از طریقِ RPC؛ تاریخِ انقضای جدید را برمی‌گرداند. */
export async function activateSubscription(
  db: DB,
  uid: string,
  plan: string,
  cycle: string,
  days: number
): Promise<string> {
  const { data, error } = await db.rpc("activate_subscription", {
    p_user: uid,
    p_plan: plan,
    p_cycle: cycle,
    p_days: days,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/** موجودیِ فعلیِ کیفِ پول (۰ اگر ردیفی نباشد). */
export async function getWallet(db: DB, uid: string): Promise<number> {
  const { data } = await db.from("wallets").select("credits").eq("user_id", uid).maybeSingle();
  return data?.credits ?? 0;
}

/** شارژِ اتمیکِ اعتبار از طریقِ RPC؛ موجودیِ جدید را برمی‌گرداند. */
export async function addCredits(db: DB, uid: string, amount: number, reason: string): Promise<number> {
  const { data, error } = await db.rpc("add_credits", {
    p_user: uid,
    p_amount: amount,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}
