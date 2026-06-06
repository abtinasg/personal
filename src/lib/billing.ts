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

/** بسته‌های شارژِ کیفِ پول (مبلغ به تومان). قابلِ تنظیم. */
export type Pack = { id: string; toman: number; credits: number; label: string };
export const PACKS: Pack[] = [
  { id: "p1", toman: 10_000, credits: 50, label: "بسته‌ی کوچک" },
  { id: "p2", toman: 25_000, credits: 150, label: "بسته‌ی متوسط" },
  { id: "p3", toman: 50_000, credits: 350, label: "بسته‌ی بزرگ" },
];

export function findPack(id: string): Pack | undefined {
  return PACKS.find((p) => p.id === id);
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
