import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * کلاینت سمت‌سرور با service-role.
 * فقط در route handler ها / server components استفاده شود — هرگز سمت کلاینت.
 */
export function getServiceClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "متغیرهای محیطی Supabase تنظیم نشده‌اند. NEXT_PUBLIC_SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY را در .env.local قرار بده."
    );
  }

  if (looksLikeAnonKey(key)) {
    throw new Error(
      "کلیدی که در SUPABASE_SERVICE_ROLE_KEY گذاشته‌ای کلید service_role نیست (به‌نظر anon/publishable می‌رسد). " +
        "از Supabase → Project Settings → API → بخش service_role (secret) کلید درست را کپی کن و سرور را ری‌استارت کن."
    );
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/** آیا کلید به‌جای service_role، کلید anon/publishable است؟ */
function looksLikeAnonKey(key: string): boolean {
  // فرمت جدید Supabase
  if (key.startsWith("sb_publishable_")) return true;
  if (key.startsWith("sb_secret_")) return false;
  // فرمت قدیمی (JWT): role را از payload می‌خوانیم
  const parts = key.split(".");
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
      if (payload?.role && payload.role !== "service_role") return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}
