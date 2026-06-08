import type { getServiceClient } from "@/lib/supabase";

type DB = ReturnType<typeof getServiceClient>;

/** IPِ کلاینت را از هدرهای پراکسی بیرون می‌کشد (همتای منطقِ مسیرِ مهمان). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export type AuditEntry = {
  actor: string; // نامِ کاربریِ ادمین یا 'system'
  action: string; // delete_row | delete_user | export | set_flag | ai_auto_kill | ...
  targetTable?: string | null;
  targetId?: string | null;
  meta?: Record<string, unknown>;
  ip?: string | null;
};

/**
 * ثبتِ یک کنشِ حساس در گزارشِ ممیزی. عمداً بی‌صدا: ثبتِ ممیزی نباید کنشِ اصلی
 * را بترکاند. هر چیزی که داده را تغییر می‌دهد یا خروجی می‌گیرد باید این را صدا بزند.
 */
export async function logAudit(db: DB, e: AuditEntry): Promise<void> {
  try {
    await db.from("audit_log").insert({
      actor: e.actor,
      action: e.action,
      target_table: e.targetTable ?? undefined,
      target_id: e.targetId != null ? String(e.targetId) : undefined,
      meta: e.meta ? JSON.stringify(e.meta) : undefined,
      ip: e.ip ?? undefined,
    });
  } catch {
    // ممیزی نباید جریانِ اصلی را متوقف کند.
  }
}
