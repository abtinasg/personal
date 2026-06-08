/**
 * مدلِ نقش و مجوز (RBAC) — منطقِ خالص، بدونِ وابستگی به دیتابیس.
 * منبعِ حقیقت برای «چه کسی اجازه‌ی چه کاری دارد».
 */

export type Role = "user" | "support" | "admin" | "owner";

export type Capability =
  | "view_admin" // دیدنِ پنل و داشبورد (خواندنی)
  | "handle_tickets" // پاسخ به تیکت‌ها
  | "manage_data" // ویرایش/حذفِ ردیفِ جدول‌ها
  | "manage_users" // حذفِ کاربر
  | "manage_flags" // کلیدهای قطع / فلگ‌ها
  | "export_data" // خروجیِ کاملِ دیتابیس (حساس)
  | "manage_roles"; // تغییرِ نقشِ اعضای تیم

/** رتبه‌ی نقش (برای مقایسه‌ی سلسله‌مراتبی). */
const RANK: Record<Role, number> = { user: 0, support: 1, admin: 2, owner: 3 };

/** حداقل نقشِ موردِنیاز برای هر مجوز. */
const MIN_ROLE: Record<Capability, Role> = {
  view_admin: "support",
  handle_tickets: "support",
  manage_data: "admin",
  manage_users: "admin",
  manage_flags: "admin",
  export_data: "owner",
  manage_roles: "owner",
};

/** آیا این نقش، این مجوز را دارد؟ */
export function can(role: Role, cap: Capability): boolean {
  return RANK[role] >= RANK[MIN_ROLE[cap]];
}

/** آیا این نقش اصلاً به پنل دسترسی دارد؟ (support به بالا) */
export function isStaff(role: Role): boolean {
  return RANK[role] >= RANK.support;
}

/** نقشِ معتبر یا fallback. */
export function normalizeRole(r: unknown): Role {
  return r === "support" || r === "admin" || r === "owner" || r === "user" ? r : "user";
}

/** owner اولیه از طریقِ ENV (بوت‌استرپ تا تیم قفل نشود). */
export function isBootstrapOwner(username: string | null | undefined): boolean {
  const env = process.env.ADMIN_USERNAME;
  return !!env && !!username && username === env;
}

/** فهرستِ مجوزهای یک نقش (برای فرستادن به کلاینت جهتِ نمایش/مخفی‌سازیِ دکمه‌ها). */
export function capabilitiesOf(role: Role): Capability[] {
  return (Object.keys(MIN_ROLE) as Capability[]).filter((c) => can(role, c));
}

/** برچسبِ فارسیِ نقش. */
export const ROLE_FA: Record<Role, string> = {
  user: "کاربر",
  support: "پشتیبان",
  admin: "مدیر",
  owner: "مالک",
};

/** نقش‌هایی که در پنل قابلِ تخصیص‌اند. */
export const ASSIGNABLE_ROLES: Role[] = ["user", "support", "admin", "owner"];
