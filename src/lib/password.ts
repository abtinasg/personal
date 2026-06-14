import crypto from "crypto";

/**
 * هش و بررسیِ امنِ رمز عبور با scrypt.
 * قالبِ ذخیره‌شده: scrypt$<saltHex>$<hashHex>
 */

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  const actual = crypto.scryptSync(password, salt, expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

/** حداقل قوانینِ رمز عبور. در صورت نامعتبر بودن، پیام خطا برمی‌گرداند؛ وگرنه null. */
export function validatePassword(password: string): string | null {
  if (typeof password !== "string" || password.length < 6) {
    return "رمز عبور باید حداقل ۶ نویسه باشد.";
  }
  return null;
}

/** نام کاربری را نرمال می‌کند (trim + حروفِ کوچک) — برای ذخیره و جست‌وجوی یکدست. */
export function normalizeUsername(input: string): string {
  return String(input || "").trim().toLowerCase();
}

/**
 * قوانینِ نام کاربری: ۳ تا ۲۰ نویسه، فقط حروفِ انگلیسی/عدد/زیرخط، شروع با حرف.
 * در صورت نامعتبر بودن، پیام خطا برمی‌گرداند؛ وگرنه null.
 */
export function validateUsername(username: string): string | null {
  const u = normalizeUsername(username);
  if (u.length < 3 || u.length > 20) {
    return "نام کاربری باید بین ۳ تا ۲۰ نویسه باشد.";
  }
  if (!/^[a-z][a-z0-9_]*$/.test(u)) {
    return "نام کاربری فقط می‌تواند شاملِ حروفِ انگلیسی، عدد و زیرخط باشد و با حرف شروع شود.";
  }
  return null;
}
