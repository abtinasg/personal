import { costOf, PLANS, annualPrice, type BillingCycle } from "@/lib/billing";
import type { getServiceClient } from "@/lib/supabase";

type DB = ReturnType<typeof getServiceClient>;

/**
 * تخمینِ هزینه‌ی هوش مصنوعی.
 *
 * مدلِ فعلی gpt-4o-mini است و ای‌اکنون توکنِ واقعی را در ai_usage ذخیره نمی‌کنیم
 * (فقط شمارشِ فراخوانی داریم). پس هزینه را «تخمینی» نشان می‌دهیم: هر فراخوانی
 * بر اساسِ وزنِ اعتباریِ همان اندپوینت (costOf) ضرب در نرخِ دلاریِ هر اعتبار.
 * وقتی توکنِ واقعی لاگ شد، فقط همین تابع عوض می‌شود.
 *
 * مبنا: gpt-4o-mini حدودِ ۰٫۱۵$ ورودی و ۰٫۶$ خروجی به ازای هر ۱M توکن. یک
 * فراخوانیِ سبک (~۱k ورودی/۴۰۰ خروجی) ≈ ۰٫۰۰۰۴$؛ سنگین (vision) چند برابر.
 * AI_USD_PER_CREDIT را با env می‌توان کالیبره کرد.
 */
export function usdPerCredit(): number {
  const n = Number(process.env.AI_USD_PER_CREDIT);
  return Number.isFinite(n) && n > 0 ? n : 0.0006;
}

/** نرخِ تبدیلِ دلار به تومان برای تخمینِ سود (با env قابلِ تنظیم). */
export function usdToToman(): number {
  const n = Number(process.env.USD_TOMAN);
  return Number.isFinite(n) && n > 0 ? n : 70_000;
}

/** هزینه‌ی تخمینیِ هوش مصنوعی (دلار) از روی شمارشِ فراخوانی به‌ازای هر اندپوینت. */
export function aiEstCostUsd(endpointCounts: Array<{ endpoint: string; n: number }>): number {
  const rate = usdPerCredit();
  return endpointCounts.reduce((sum, e) => sum + costOf(e.endpoint) * e.n * rate, 0);
}

/** سقفِ سختِ روزانه‌ی فراخوانیِ هوش مصنوعی (همتای aiGuard). */
export function aiGlobalDailyCap(): number {
  const n = Number(process.env.AI_GLOBAL_DAILY_CAP);
  return Number.isFinite(n) ? n : 5000;
}

/**
 * MRR (درآمدِ ماهانه‌ی تکرارشونده) را از شمارشِ اشتراک‌های فعال به تفکیکِ پلن/دوره
 * می‌سازد. درگاه‌های ایرانی auto-debit ندارند، پس این «MRRِ نرمالایزشده» است:
 * سهمِ ماهانه‌ی هر اشتراکِ فعال (سالانه ÷ ۱۲).
 */
export function computeMrr(subs: Array<{ plan: string; cycle: string; n: number }>): number {
  let mrr = 0;
  for (const s of subs) {
    const plan = PLANS.find((p) => p.id === s.plan);
    if (!plan) continue;
    const monthly =
      s.cycle === "annual" ? annualPrice(plan.priceMonthly) / 12 : plan.priceMonthly;
    mrr += monthly * s.n;
  }
  return Math.round(mrr);
}

/**
 * خرجِ تخمینیِ هوش مصنوعیِ امروز (به وقتِ تهران) — مبنای پایشِ هزینه و قطعِ خودکار.
 * یک کوئریِ گروه‌بندی‌شده روی ai_usage می‌زند و با نرخِ هر اعتبار به دلار/تومان
 * تبدیل می‌کند. هم کرانِ cost-guard و هم داشبورد از این استفاده می‌کنند.
 */
export async function aiSpendToday(
  db: DB
): Promise<{ usd: number; toman: number; calls: number }> {
  const rows = await db.query<{ endpoint: string; n: unknown }>(
    `select endpoint, count(*) as n from public.ai_usage
       where (created_at at time zone 'Asia/Tehran') >= date_trunc('day', now() at time zone 'Asia/Tehran')
       group by endpoint`
  );
  const counts = rows.map((r) => ({ endpoint: String(r.endpoint), n: Number(r.n ?? 0) || 0 }));
  const usd = aiEstCostUsd(counts);
  const calls = counts.reduce((s, c) => s + c.n, 0);
  return { usd, toman: Math.round(usd * usdToToman()), calls };
}

/** برچسبِ فارسیِ پلن برای نمایش. */
export function planLabel(plan: string | null): string {
  const p = PLANS.find((x) => x.id === plan);
  if (p) return p.name;
  if (plan === "credits" || !plan) return "اعتبار";
  return plan;
}

export type { BillingCycle };
