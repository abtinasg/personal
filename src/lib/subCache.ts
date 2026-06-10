import type { ActiveSub } from "@/lib/billing";

/**
 * کشِ درون‌حافظه‌ایِ کوتاهِ «اشتراکِ فعال» به‌ازای هر کاربر.
 *
 * چرا: guardAI روی هر فراخوانیِ AI یک SELECT روی subscriptions می‌زند، در حالی
 * که اشتراک به‌ندرت عوض می‌شود. TTL=۳۰ث همان الگوی flags است.
 *
 * این ماژول عمداً «خالص» است (هیچ importِ runtime از billing ندارد) تا
 * billing.ts بتواند بدونِ حلقه‌ی وابستگی bustSubCache را صدا بزند.
 */

const TTL_MS = 30_000;
const cache = new Map<string, { at: number; sub: ActiveSub }>();

/** نتیجه‌ی کش‌شده (شاملِ nullِ کش‌شده) یا null اگر کش نداریم/بیات شده. */
export function getCachedSub(uid: string): { sub: ActiveSub } | null {
  const hit = cache.get(uid);
  if (hit && Date.now() - hit.at < TTL_MS) return { sub: hit.sub };
  return null;
}

export function setCachedSub(uid: string, sub: ActiveSub): void {
  cache.set(uid, { at: Date.now(), sub });
}

/** بعد از فعال‌سازی/تمدیدِ اشتراک صدا بزن تا کاربرِ تازه‌پرداخت‌کرده پشتِ کش نماند. */
export function bustSubCache(uid: string): void {
  cache.delete(uid);
}
