import type { Instrumentation } from "next";

/**
 * هوکِ سراسریِ Next برای خطاهای uncaught — هر مسیری که خطای گرفته‌نشده بدهد
 * (دیتابیس قطع، FK شکسته، باگِ غیرمنتظره) این‌جا با مسیر و متد در app_logs
 * ثبت می‌شود. مسیرهایی که خودشان catch می‌کنند و پیامِ فارسی برمی‌گردانند
 * این‌جا نمی‌آیند — آن‌ها عمدی‌اند و خودشان (در صورتِ نیاز) لاگ می‌کنند.
 *
 * مهم: این فایل هیچ importِ واقعی ندارد (فقط type). importِ لاگر این‌جا کلِ
 * build را می‌شکند، چون وب‌پک درایورِ postgres را برای edge هم باندل می‌کند
 * (net/tls ندارد) و serverExternalPackages روی instrumentation اثر نمی‌کند.
 * به‌جایش از پلی استفاده می‌کنیم که log.ts روی globalThis ثبت کرده است.
 */
type BridgedLog = (
  scope: string,
  event: string,
  opts?: { message?: string; detail?: Record<string, unknown> }
) => Promise<void>;

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const e = err as { message?: string; name?: string; stack?: string; digest?: string } | null;
  const detail = {
    error: e?.message ?? String(err),
    errorName: e?.name,
    stack: e?.stack?.split("\n").slice(0, 4).join("\n"),
    digest: e?.digest,
    routePath: context.routePath,
    routeType: context.routeType,
  };

  const log = (globalThis as Record<string, unknown>).__appLogError as BridgedLog | undefined;
  if (!log) {
    // لاگر هنوز لود نشده (هیچ مسیری به دیتابیس دست نزده) — حداقل روی console بماند.
    console.error(`[server] unhandled_error — ${request.method} ${request.path}`, detail);
    return;
  }
  try {
    await log("server", "unhandled_error", {
      message: `${request.method} ${request.path}`,
      detail,
    });
  } catch {
    // لاگرِ سراسری هرگز نباید خودش خطای جدید تولید کند.
  }
};
