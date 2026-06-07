const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/** ارقام انگلیسی را به فارسی تبدیل می‌کند. */
export function faDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

/** ارقام فارسی و عربی را به انگلیسی تبدیل می‌کند (برای پردازشِ ورودیِ کاربر). */
export function toEnDigits(input: string): string {
  return String(input)
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

/**
 * هر رشته‌ی ورودی (با ارقامِ فارسی/عربی و جداکننده‌ی هزارگان) را به عدد تبدیل می‌کند.
 * مثلاً «۲۰۰٬۰۰۰» یا «۲۰۰,۰۰۰» → 200000.
 */
export function parseNum(input: string | number | null | undefined): number {
  if (typeof input === "number") return input;
  if (input == null) return 0;
  const clean = toEnDigits(input).replace(/[^\d.-]/g, "");
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

/**
 * رشته‌ی ورودیِ پول را با ارقامِ فارسی و جداکننده‌ی هزارگان قالب‌بندی می‌کند.
 * فقط ارقامِ صحیح را نگه می‌دارد: «۲۰۰۰۰۰» → «۲۰۰٬۰۰۰».
 */
export function groupFa(input: string): string {
  const digits = toEnDigits(input).replace(/[^\d]/g, "");
  if (!digits) return "";
  return faDigits(Number(digits).toLocaleString("en-US"));
}

/** عددِ تومان را خوانا نشان می‌دهد: «۲۰۰ هزار تومان»، «۱٫۵ میلیون تومان». */
export function tomanWords(n: number): string {
  if (n == null || isNaN(n) || n === 0) return "";
  const trim = (v: number) => faDigits(v.toFixed(1).replace(/\.0$/, "").replace(".", "٫"));
  if (n >= 1e9) return `${trim(n / 1e9)} میلیارد تومان`;
  if (n >= 1e6) return `${trim(n / 1e6)} میلیون تومان`;
  if (n >= 1e3) return `${trim(n / 1e3)} هزار تومان`;
  return `${fa(n)} تومان`;
}

/** عدد را با جداکننده‌ی هزارگان و ارقام فارسی نشان می‌دهد. */
export function fa(n: number, maximumFractionDigits = 0): string {
  if (n == null || isNaN(n)) return faDigits(0);
  return faDigits(n.toLocaleString("en-US", { maximumFractionDigits }));
}

/** مبلغ پول با واحد. */
export function money(n: number, currency = "تومان"): string {
  return `${fa(Math.round(n))} ${currency}`;
}

/** عددِ بزرگ را فشرده نشان می‌دهد: «۱۱٫۷ میلیارد»، «۱۳۰ میلیون». */
export function faShort(n: number): string {
  if (n == null || isNaN(n)) return faDigits(0);
  const trim = (v: number) => faDigits(v.toFixed(1).replace(/\.0$/, ""));
  if (n >= 1e9) return `${trim(n / 1e9)} میلیارد`;
  if (n >= 1e6) return `${trim(n / 1e6)} میلیون`;
  return fa(n);
}

/** تاریخ امروز به‌صورت YYYY-MM-DD در منطقه‌ی زمانی محلی. */
export function todayISO(d = new Date()): string {
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 10);
}

/** n روز قبل به‌صورت ISO. */
export function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return todayISO(d);
}

/** فقط بخش تاریخ (YYYY-MM-DD) — DB ممکن است "2026-06-07T00:00:00.000Z" برگرداند. */
export function isoDay(s: string): string {
  return s.slice(0, 10);
}

const jalaliFull = new Intl.DateTimeFormat("fa-IR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const jalaliShort = new Intl.DateTimeFormat("fa-IR", { day: "numeric", month: "long" });
const jalaliWeekday = new Intl.DateTimeFormat("fa-IR", { weekday: "short" });

function toDate(iso: string | Date): Date {
  if (typeof iso !== "string") return iso;
  return new Date(iso.includes("T") ? iso : iso + "T00:00:00");
}

export function jDate(iso: string | Date): string {
  return jalaliFull.format(toDate(iso));
}
export function jDateShort(iso: string | Date): string {
  return jalaliShort.format(toDate(iso));
}
export function jWeekday(iso: string | Date): string {
  return jalaliWeekday.format(toDate(iso));
}

/** YYYY-MM ماهِ جاری. */
export function monthKey(d = new Date()): string {
  return todayISO(d).slice(0, 7);
}
export function monthStart(key: string): string {
  return `${key}-01`;
}
export function monthLabel(key: string): string {
  const d = new Date(key + "-01T00:00:00");
  return new Intl.DateTimeFormat("fa-IR", { month: "long", year: "numeric" }).format(d);
}
