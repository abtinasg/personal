"use client";

import { ApiError } from "@/lib/client";
import { AppIcon } from "@/components/AppIcon";

/**
 * نمایشِ خطای سرویس‌های هوش مصنوعی. اگر خطا «اتمامِ اعتبار» باشد (۴۰۲)،
 * علاوه بر پیام، دکمه‌ی «شارژ کیف پول» نشان داده می‌شود.
 */
export function AiError({ error, className = "" }: { error: unknown; className?: string }) {
  if (!error) return null;
  const msg = error instanceof Error ? error.message : "خطایی رخ داد.";
  const needTopUp = error instanceof ApiError && error.code === "INSUFFICIENT_CREDITS";
  return (
    <div className={className}>
      <p className="text-ios-red text-[13px]">{msg}</p>
      {needTopUp && (
        <a
          href="/wallet"
          className="inline-flex items-center gap-1.5 mt-2 rounded-full bg-ios-blue/10 text-ios-blue text-[13px] font-bold px-3 py-1.5 active:opacity-60"
        >
          <AppIcon name="wallet" size={15} className="text-ios-blue" />
          شارژ کیف پول
        </a>
      )}
    </div>
  );
}
