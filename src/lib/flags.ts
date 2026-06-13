import type { getServiceClient } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";

type DB = ReturnType<typeof getServiceClient>;

export type Flag = {
  key: string;
  enabled: boolean;
  value: Record<string, unknown> | null;
  description: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
};

/** کلیدهای شناخته‌شده — برای تایپ‌سیفتی و نمایش در پنل. */
export type FlagKey =
  | "ai_enabled"
  | "signups_enabled"
  | "payments_enabled"
  | "maintenance_mode"
  | "ai_daily_budget";

/**
 * کشِ درون‌حافظه‌ایِ کلِ فلگ‌ها. در هر اینستنسِ serverless ~۳۰ ثانیه زنده می‌ماند
 * تا مسیرهای داغ (مثلِ aiGuard در هر فراخوانیِ AI) به‌ازای هر درخواست یک کوئریِ
 * دیتابیس نزنند. تغییرِ فلگ از همان اینستنس کش را فوراً باطل می‌کند؛ اینستنس‌های
 * دیگر حداکثر ۳۰ ثانیه بعد هماهنگ می‌شوند — برای ابزارِ یک‌نفره کافی است.
 */
const TTL_MS = 5_000;
let cache: { at: number; map: Map<string, Flag> } | null = null;

function rowToFlag(r: Record<string, unknown>): Flag {
  return {
    key: String(r.key),
    enabled: !!r.enabled,
    value: (r.value as Record<string, unknown> | null) ?? null,
    description: (r.description as string) ?? null,
    updatedBy: (r.updated_by as string) ?? null,
    updatedAt: r.updated_at ? String(r.updated_at) : null,
  };
}

async function loadAll(db: DB): Promise<Map<string, Flag>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.map;
  const map = new Map<string, Flag>();
  try {
    const { data } = await db.from("feature_flags").select("*");
    for (const r of (data ?? []) as Record<string, unknown>[]) {
      const f = rowToFlag(r);
      map.set(f.key, f);
    }
    cache = { at: Date.now(), map };
  } catch {
    // اگر دیتابیس قطع بود، از کشِ قبلی (هرچند بیات) استفاده کن؛ وگرنه نقشه‌ی خالی.
    if (cache) return cache.map;
  }
  return map;
}

/** همه‌ی فلگ‌ها (برای پنلِ مدیریت). */
export async function getAllFlags(db: DB): Promise<Flag[]> {
  const map = await loadAll(db);
  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
}

/** یک فلگ یا null. */
export async function getFlag(db: DB, key: FlagKey): Promise<Flag | null> {
  const map = await loadAll(db);
  return map.get(key) ?? null;
}

/**
 * آیا این قابلیت روشن است؟ maintenance_mode به‌عنوانِ کلیدِ اصلی همه‌چیز را قطع
 * می‌کند. اگر فلگ وجود نداشت، fallback برمی‌گردد (پیش‌فرض true = باز).
 */
export async function isEnabled(db: DB, key: FlagKey, fallback = true): Promise<boolean> {
  const map = await loadAll(db);
  const maint = map.get("maintenance_mode");
  if (maint?.enabled && key !== "maintenance_mode") return false;
  const f = map.get(key);
  return f ? f.enabled : fallback;
}

/** کش را دستی باطل می‌کند (بعد از نوشتن). */
export function bustFlagCache(): void {
  cache = null;
}

/**
 * تنظیم/ساختِ یک فلگ + ثبت در ممیزی. actor نامِ کاربریِ ادمین یا 'system' است.
 * value را همان‌طور که هست به jsonb می‌سپارد (Postgres رشته‌ی JSONِ معتبر را
 * cast می‌کند).
 */
export async function setFlag(
  db: DB,
  key: string,
  patch: { enabled?: boolean; value?: Record<string, unknown> | null },
  actor: string,
  ip?: string | null
): Promise<void> {
  const fields: Record<string, unknown> = { key, updated_by: actor, updated_at: new Date().toISOString() };
  if (patch.enabled !== undefined) fields.enabled = patch.enabled;
  if (patch.value !== undefined) fields.value = patch.value === null ? null : JSON.stringify(patch.value);

  await db.from("feature_flags").upsert(fields, { onConflict: "key" });
  bustFlagCache();
  await logAudit(db, {
    actor,
    action: "set_flag",
    targetTable: "feature_flags",
    targetId: key,
    meta: patch as Record<string, unknown>,
    ip,
  });
}
