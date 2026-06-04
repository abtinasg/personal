/**
 * فهرستِ مجازِ جدول‌هایی که پنل مدیریت اجازه‌ی خواندن/ویرایش/حذفِ آن‌ها را دارد.
 * هر چیزی بیرونِ این لیست رد می‌شود تا تزریقِ نامِ جدولِ دلخواه ممکن نباشد.
 */
export const ADMIN_TABLES = [
  "users",
  "credentials",
  "profiles",
  "meals",
  "transactions",
  "health_metrics",
  "habits",
  "habit_logs",
  "moods",
  "identities",
  "missions",
  "mission_milestones",
  "mission_habits",
  "rewards",
  "reward_claims",
  "workout_plans",
  "purchase_goals",
] as const;

export type AdminTable = (typeof ADMIN_TABLES)[number];

/** ستونی که برای مرتب‌سازیِ نزولی استفاده می‌شود (جدیدترین اول). همه created_at دارند جز جدول‌های واسط. */
export const TABLE_ORDER_COLUMN: Record<string, string> = {
  mission_habits: "mission_id",
};

export function isAdminTable(name: string | null): name is AdminTable {
  return !!name && (ADMIN_TABLES as readonly string[]).includes(name);
}
