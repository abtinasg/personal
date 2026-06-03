import type { Tab } from "@/lib/types";

/**
 * نگاشتِ مقصدهای قدیمی (کلیدهای Tab که در ویوها استفاده می‌شوند) به مسیرهای واقعیِ روتر.
 * زیرصفحه‌ها با کوئریِ ?seg انتخاب می‌شوند تا داشبورد بتواند مستقیم به یک بخش بپرد.
 */
export function hrefForTab(t: Tab): string {
  switch (t) {
    case "home":
      return "/";
    case "identities":
      return "/grow?seg=identities";
    case "habit":
      return "/grow?seg=habits";
    case "missions":
      return "/grow?seg=missions";
    case "rewards":
      return "/grow?seg=rewards";
    case "calorie":
      return "/health?seg=calorie";
    case "health":
      return "/health?seg=body";
    case "budget":
      return "/budget";
    case "workout":
      return "/coach";
    default:
      return "/";
  }
}
