import { createECDH, createHmac, createCipheriv, randomBytes, createPrivateKey, sign } from "crypto";

/**
 * Web Push بدونِ وابستگیِ خارجی — پیاده‌سازیِ مستقیمِ:
 *   • RFC 8291 (رمزنگاریِ پیام، aes128gcm)
 *   • RFC 8188 (قالبِ محتوای رمزشده)
 *   • RFC 8292 (احرازِ هویتِ VAPID با ES256)
 * فقط با ماژولِ crypto خودِ Node کار می‌کند.
 */

export type PushSub = { endpoint: string; keys: { p256dh: string; auth: string } };

const SUBJECT = process.env.VAPID_SUBJECT || "mailto:hello@example.com";

export function vapidPublicKey(): string {
  return process.env.VAPID_PUBLIC_KEY || "";
}

export function hasVapid(): boolean {
  return !!process.env.VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY;
}

const b64 = (b: Buffer): string => b.toString("base64url");
const hmac = (key: Buffer, data: Buffer): Buffer => createHmac("sha256", key).update(data).digest();

/** کلیدِ خصوصیِ VAPID را از فرمتِ خامِ base64url به KeyObject تبدیل می‌کند. */
function vapidPrivateKeyObject() {
  const pub = Buffer.from(vapidPublicKey(), "base64url"); // 0x04 || x(32) || y(32)
  const x = pub.subarray(1, 33).toString("base64url");
  const y = pub.subarray(33, 65).toString("base64url");
  return createPrivateKey({
    key: { kty: "EC", crv: "P-256", d: process.env.VAPID_PRIVATE_KEY as string, x, y },
    format: "jwk",
  });
}

/** سرآیندِ Authorization برای VAPID (RFC 8292): `vapid t=<jwt>, k=<publicKey>`. */
function vapidAuthHeader(endpoint: string): string {
  const aud = new URL(endpoint).origin;
  const header = b64(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = b64(
    Buffer.from(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SUBJECT }))
  );
  const signingInput = `${header}.${payload}`;
  const signature = sign("sha256", Buffer.from(signingInput), {
    key: vapidPrivateKeyObject(),
    dsaEncoding: "ieee-p1363",
  });
  const jwt = `${signingInput}.${b64(signature)}`;
  return `vapid t=${jwt}, k=${vapidPublicKey()}`;
}

/** بدنه‌ی رمزشده‌ی aes128gcm را برای یک اشتراک می‌سازد (RFC 8291). */
function encrypt(sub: PushSub, plaintext: Buffer): Buffer {
  const uaPublic = Buffer.from(sub.keys.p256dh, "base64url"); // 65 بایت
  const authSecret = Buffer.from(sub.keys.auth, "base64url"); // 16 بایت

  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey(); // 65 بایت
  const sharedSecret = ecdh.computeSecret(uaPublic); // 32 بایت
  const salt = randomBytes(16);

  // مرحله‌ی ۱ — ترکیب با auth_secret (RFC 8291 §3.4)
  const prkKey = hmac(authSecret, sharedSecret);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
  const ikm = hmac(prkKey, Buffer.concat([keyInfo, Buffer.from([1])])).subarray(0, 32);

  // مرحله‌ی ۲ — کلیدِ محتوا (CEK) و nonce
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.concat([Buffer.from("Content-Encoding: aes128gcm\0"), Buffer.from([1])])).subarray(0, 16);
  const nonce = hmac(prk, Buffer.concat([Buffer.from("Content-Encoding: nonce\0"), Buffer.from([1])])).subarray(0, 12);

  // قالبِ RFC 8188 — یک رکورد
  const recordSize = 4096;
  const rs = Buffer.from([
    (recordSize >>> 24) & 0xff,
    (recordSize >>> 16) & 0xff,
    (recordSize >>> 8) & 0xff,
    recordSize & 0xff,
  ]);
  const head = Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic]);

  const padded = Buffer.concat([plaintext, Buffer.from([2])]); // 0x02 = آخرین رکورد
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const enc = Buffer.concat([cipher.update(padded), cipher.final(), cipher.getAuthTag()]);

  return Buffer.concat([head, enc]);
}

/**
 * یک پیام به یک اشتراک می‌فرستد. `gone=true` یعنی اشتراک باطل شده (۴۰۴/۴۱۰)
 * و باید از دیتابیس حذف شود.
 */
export async function sendPush(
  sub: PushSub,
  payload: object,
  ttl = 2419200
): Promise<{ ok: boolean; status: number; gone: boolean }> {
  const body = encrypt(sub, Buffer.from(JSON.stringify(payload)));
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(ttl),
      Authorization: vapidAuthHeader(sub.endpoint),
    },
    body: body as unknown as BodyInit,
  });
  return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410 };
}
