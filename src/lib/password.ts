import crypto from "crypto";

// استفاده از PBKDF2 برای هش کردن رمز
const HASH_ITERATIONS = 100000;
const HASH_ALGORITHM = "sha256";
const HASH_KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString("base64");
    crypto.pbkdf2(password, salt, HASH_ITERATIONS, HASH_KEYLEN, HASH_ALGORITHM, (err, derived) => {
      if (err) reject(err);
      else resolve(`${HASH_ITERATIONS}:${salt}:${derived.toString("base64")}`);
    });
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [iterations, salt, storedHash] = hash.split(":");
    const iters = parseInt(iterations, 10);

    crypto.pbkdf2(password, salt, iters, HASH_KEYLEN, HASH_ALGORITHM, (err, derived) => {
      if (err) reject(err);
      else resolve(derived.toString("base64") === storedHash);
    });
  });
}
