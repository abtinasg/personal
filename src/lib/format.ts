const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/** ارقام انگلیسی را به فارسی تبدیل می‌کند. */
export function faDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
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

const jalaliFull = new Intl.DateTimeFormat("fa-IR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const jalaliShort = new Intl.DateTimeFormat("fa-IR", { day: "numeric", month: "long" });
const jalaliWeekday = new Intl.DateTimeFormat("fa-IR", { weekday: "short" });

export function jDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso + "T00:00:00") : iso;
  return jalaliFull.format(d);
}
export function jDateShort(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso + "T00:00:00") : iso;
  return jalaliShort.format(d);
}
export function jWeekday(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso + "T00:00:00") : iso;
  return jalaliWeekday.format(d);
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
