import { apiSend } from "@/lib/client";

/** آیا مرورگر از Web Push پشتیبانی می‌کند؟ */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

/** آیا همین حالا اشتراکِ فعالی هست؟ */
export async function isPushEnabled(): Promise<boolean> {
  if (!isPushSupported() || Notification.permission !== "granted") return false;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return !!sub;
}

/** ثبتِ SW + گرفتنِ اجازه + اشتراک + ذخیره در سرور. */
export async function enablePush(): Promise<{ ok: boolean; reason?: string }> {
  if (!isPushSupported()) return { ok: false, reason: "مرورگرت از نوتیفیکیشن پشتیبانی نمی‌کنه." };
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return { ok: false, reason: "کلیدِ نوتیفیکیشن روی سرور تنظیم نشده." };

  const reg = await registerServiceWorker();
  if (!reg) return { ok: false, reason: "ثبتِ سرویس‌ورکر ناموفق بود." };

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: "برای یادآوری‌ها باید اجازه بدی." };

  await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
  });
  const json = sub.toJSON() as { keys?: { p256dh?: string; auth?: string } };
  await apiSend("/api/push/subscribe", "POST", {
    endpoint: sub.endpoint,
    keys: json.keys,
  });
  return { ok: true };
}

/** لغوِ اشتراک + حذف از سرور. */
export async function disablePush(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await apiSend("/api/push/unsubscribe", "POST", { endpoint: sub.endpoint }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
}
