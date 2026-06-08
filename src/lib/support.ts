/**
 * ثابت‌های مشترکِ سیستمِ پشتیبانی — لیستِ مجازِ دسته‌بندی‌ها، اولویت‌ها و وضعیت‌ها.
 * هر دو سمتِ سرور و کلاینت به اینها نیاز دارند تا نگاشتِ برچسبِ فارسی همه‌جا یکی باشد.
 */

export const TICKET_CATEGORIES = [
  "auth",
  "otp",
  "payment",
  "subscription",
  "ai_quality",
  "bug",
  "notification",
  "data",
  "refund",
  "abuse",
  "feature_request",
  "general",
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<TicketCategory, string> = {
  auth: "ورود/حساب",
  otp: "کد تایید",
  payment: "پرداخت",
  subscription: "اشتراک",
  ai_quality: "کیفیتِ جوانه",
  bug: "گزارش باگ",
  notification: "نوتیفیکیشن",
  data: "داده‌ها",
  refund: "استرداد",
  abuse: "گزارشِ سوءاستفاده",
  feature_request: "پیشنهادِ ویژگی",
  general: "عمومی",
};

export const TICKET_PRIORITIES = ["p0", "p1", "p2", "p3"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  p0: "بحرانی",
  p1: "بالا",
  p2: "متوسط",
  p3: "کم",
};

/** SLA به ساعت — برای محاسبه‌ی موعد و نمایش هشدارِ تأخیر. */
export const PRIORITY_SLA_HOURS: Record<TicketPriority, number> = {
  p0: 2,
  p1: 8,
  p2: 24,
  p3: 72,
};

export const TICKET_STATUSES = ["new", "open", "waiting_user", "resolved", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const STATUS_LABEL: Record<TicketStatus, string> = {
  new: "تازه",
  open: "در حال بررسی",
  waiting_user: "منتظرِ کاربر",
  resolved: "حل شد",
  closed: "بسته",
};

export const STATUS_DOT: Record<TicketStatus, string> = {
  new: "#ff453a",
  open: "#ff9f0a",
  waiting_user: "#0a84ff",
  resolved: "#34c759",
  closed: "#8e8e93",
};

export function isCategory(x: unknown): x is TicketCategory {
  return typeof x === "string" && (TICKET_CATEGORIES as readonly string[]).includes(x);
}
export function isPriority(x: unknown): x is TicketPriority {
  return typeof x === "string" && (TICKET_PRIORITIES as readonly string[]).includes(x);
}
export function isStatus(x: unknown): x is TicketStatus {
  return typeof x === "string" && (TICKET_STATUSES as readonly string[]).includes(x);
}

/**
 * اولویتِ خودکار را از دسته‌بندی حدس می‌زند — کاربر معمولاً اولویت را اشتباه می‌گذارد
 * (همه «بحرانی» می‌زنند). به‌جای اعتمادِ به ورودیِ کاربر، اولویت را اینجا ست می‌کنیم.
 */
export function priorityForCategory(c: TicketCategory): TicketPriority {
  switch (c) {
    case "payment":
    case "refund":
    case "data":
      return "p1";
    case "abuse":
      return "p1";
    case "otp":
    case "auth":
    case "subscription":
      return "p2";
    case "bug":
    case "ai_quality":
    case "notification":
      return "p2";
    case "feature_request":
    case "general":
    default:
      return "p3";
  }
}
