import { createPgClient, type PgClient } from "@/lib/pg";
// سایداِفکت: لاگر پلِ سراسری‌اش (globalThis.__appLogError) را ثبت می‌کند تا
// instrumentation.ts بدونِ importِ مستقیم به آن دسترسی داشته باشد. این import
// دور (cycle) دارد ولی امن است — log.ts فقط در زمانِ صدازدن از getServiceClient
// استفاده می‌کند، نه هنگامِ eval.
import "@/lib/log";

let cached: PgClient | null = null;

/**
 * کلاینت سمت‌سرور با اتصالِ مستقیم به PostgreSQL.
 * فقط در route handler ها / server components استفاده شود — هرگز سمت کلاینت.
 */
export function getServiceClient(): PgClient {
  if (cached) return cached;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "متغیرِ محیطیِ DATABASE_URL تنظیم نشده است. " +
        "در .env.local مقدارش را قرار بده: DATABASE_URL=postgres://user:pass@host:5432/db"
    );
  }

  cached = createPgClient(url);
  return cached;
}
