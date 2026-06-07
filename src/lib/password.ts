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
