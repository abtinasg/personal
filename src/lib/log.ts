import { getServiceClient } from "@/lib/supabase";
import { logEvent } from "@/lib/events";

/**
 * لاگرِ مرکزیِ اپ — پاسخ به «چرا اپ گاهی کار نمی‌کند؟».
 *
 * دو مقصد دارد:
 *  ۱) console — برای لاگِ زنده‌ی کانتینر (docker logs / پنلِ آروان).
 *  ۲) جدولِ app_logs — ماندگار و قابلِ دیدن از تبِ «لاگ‌ها»ی پنلِ مدیریت،
 *     چون لاگِ کانتینر بعد از ری‌استارت می‌پرد و جست‌وجویش سخت است.
 *
 * عمداً «بی‌صدا» است: لاگ‌کردن هرگز نباید مسیرِ اصلیِ کاربر را بترکاند —
 * هر خطای دیتابیس بلعیده می‌شود (ولی روی console می‌ماند). همه‌ی توابع
 * fire-and-forget هستند؛ await لازم نیست.
 */

export type LogLevel = "error" | "warn" | "info";

/** بخش‌های اپ — برای فیلترکردن در پنل. آزاد است ولی این‌ها استانداردند. */
export type LogScope =
  | "ai"       // فراخوانی‌های هوش مصنوعی (openrouter)
  | "server"   // خطاهای uncaught هر مسیر (instrumentation)
  | "auth"     // ورود/OTP/پسکی
  | "sms"      // ارسالِ پیامک
  | "billing"  // درگاهِ پرداخت
  | "push"     // نوتیفیکیشن
  | "capture"  // ثبتِ خودکارِ غذا/خرج از چت
  | "cron";    // کارهای زمان‌بندی‌شده

type LogOpts = {
  message?: string;
  detail?: Record<string, unknown>;
  userId?: string | null;
};

/** یک خطای ناشناخته را به فیلدهای قابلِ ذخیره تبدیل می‌کند (برای detail). */
export function errDetail(e: unknown): Record<string, unknown> {
  if (e instanceof Error) {
    return {
      error: e.message,
      errorName: e.name,
      // فقط چند خطِ اولِ stack — کافی برای پیداکردنِ محل، بدونِ بادکردنِ جدول.
      stack: e.stack?.split("\n").slice(0, 4).join("\n"),
    };
  }
  return { error: String(e) };
}

async function write(level: LogLevel, scope: LogScope, event: string, opts: LogOpts): Promise<void> {
  const { message, detail, userId } = opts;

  // (۱) console — همیشه، تا در لاگِ زنده‌ی کانتینر هم دیده شود.
  const line = `[${scope}] ${event}${message ? ` — ${message}` : ""}`;
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  fn(line, detail ? JSON.stringify(detail).slice(0, 800) : "");

  // (۲) دیتابیس — best-effort.
  try {
    const db = getServiceClient();
    await db.from("app_logs").insert({
      level,
      scope,
      event,
      message: message ?? null,
      detail: detail ? JSON.stringify(detail) : undefined,
      user_id: userId ?? null,
    });
    // خطای AI همچنان رویدادِ ai_error هم ثبت می‌کند تا شمارنده‌ی
    // «خطاهای امروز» در داشبوردِ مدیریت (که از events می‌خواند) کار کند.
    if (scope === "ai" && level === "error") {
      await logEvent(db, "ai_error", { userId, props: { event, ...detail } });
    }
  } catch {
    // لاگ‌کردن نباید جریانِ اصلی را متوقف کند.
  }
}

/** خطا — چیزی که کاربر را از کار انداخته یا داده از دست رفته. */
export function logError(scope: LogScope, event: string, opts: LogOpts = {}): Promise<void> {
  return write("error", scope, event, opts);
}

/** هشدار — اپ کار کرد ولی غیرعادی (مثلاً fallback مدلِ AI فعال شد). */
export function logWarn(scope: LogScope, event: string, opts: LogOpts = {}): Promise<void> {
  return write("warn", scope, event, opts);
}

/** اطلاعات — سیگنال‌های عملیاتیِ کم‌تکرار (مثلاً اجرای موفقِ کرون). */
export function logInfo(scope: LogScope, event: string, opts: LogOpts = {}): Promise<void> {
  return write("info", scope, event, opts);
}

// پلِ سراسری برای instrumentation.ts: آن فایل نمی‌تواند مستقیم این ماژول را
// import کند (وب‌پک درایورِ postgres را برای edge باندل می‌کند و کلِ build
// می‌شکند — serverExternalPackages هم روی instrumentation اثر ندارد). پس
// لاگر خودش را روی globalThis ثبت می‌کند؛ این ماژول با لایه‌ی دیتابیس در هر
// پروسه‌ی سرور لود می‌شود، پس پل عملاً همیشه برقرار است.
(globalThis as Record<string, unknown>).__appLogError = (
  scope: string,
  event: string,
  opts?: LogOpts
) => write("error", scope as LogScope, event, opts ?? {});
