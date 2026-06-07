import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { sendPush, hasVapid } from "@/lib/push";
import { userSnapshot, type UserSnapshot } from "@/lib/coach";
import { fa } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** پیامِ پیش‌فرض وقتی به هر دلیلی نشد عکسِ وضعیتِ کاربر را گرفت. */
const FALLBACK = { title: "صبح بخیر 🌱", body: "یه روزِ نو شروع شد — بیا امروزتو با هم بسازیم." };

/** پیامِ صبحگاهیِ شخصی‌شده‌ی جوانه بر اساسِ وضعیتِ واقعیِ کاربر. */
function morningFor(snap: UserSnapshot, name: string | null): { title: string; body: string } {
  const who = name && name !== "مهمان" ? ` ${name}` : "";
  const title = `صبح بخیر${who} 🌱`;
  const pending = Math.max(0, snap.habits.total - snap.habits.doneToday);

  // هنوز چیزی نساخته — دعوتِ نرم به اولین قدم
  if (snap.habits.total === 0 && !snap.activeMission) {
    return { title, body: "بیا امروز اولین قدمت رو با هم بسازیم — یه هدفِ کوچیک." };
  }
  // استریکِ خوب — جشن بگیر و ادامه بده
  if (snap.streak >= 3) {
    return {
      title,
      body:
        `${fa(snap.streak)} روزِ پیاپی عالی بودی، داری ریشه می‌دی! ` +
        (pending > 0 ? `امروز ${fa(pending)} قدمِ کوچیک تا ادامه‌ش.` : "امروزم بترکون."),
    };
  }
  // ماموریتِ فعال — یادآوریِ هدفِ بزرگ
  if (snap.activeMission) {
    return {
      title,
      body:
        `ماموریتِ «${snap.activeMission.title}» منتظرته. ` +
        (pending > 0 ? `امروز ${fa(pending)} قدمِ کوچیک داری.` : "بریم یه قدم جلوتر؟"),
    };
  }
  // حالتِ معمول — قدم‌های امروز
  if (pending > 0) {
    return { title, body: `امروز ${fa(pending)} قدمِ کوچیک داری. بریم با هم شروع کنیم؟` };
  }
  return FALLBACK;
}

/** کرانِ نوتیفیکیشن. با هدرِ Authorization: Bearer <CRON_SECRET> یا ?secret= صدا بزن. */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  const provided =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    url.searchParams.get("secret") ||
    "";
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasVapid()) {
    return NextResponse.json({ error: "VAPID تنظیم نشده است." }, { status: 500 });
  }

  const db = getServiceClient();
  const { data: subs } = await db
    .from("push_subscriptions")
    .select("endpoint, user_id, p256dh, auth");

  // اشتراک‌ها را بر اساسِ کاربر گروه می‌کنیم تا برای هر کاربر یک‌بار پیام بسازیم
  // و به همه‌ی دستگاه‌هایش بفرستیم.
  const byUser = new Map<string, { endpoint: string; p256dh: string; auth: string }[]>();
  for (const s of subs ?? []) {
    const uid = s.user_id as string;
    const arr = byUser.get(uid) ?? [];
    arr.push({ endpoint: s.endpoint as string, p256dh: s.p256dh as string, auth: s.auth as string });
    byUser.set(uid, arr);
  }

  const userIds = [...byUser.keys()];
  const { data: users } = userIds.length
    ? await db.from("users").select("id, display_name").in("id", userIds)
    : { data: [] as { id: string; display_name: string | null }[] };
  const nameOf = new Map((users ?? []).map((u) => [u.id as string, (u.display_name as string | null) ?? null]));

  let sent = 0;
  let removed = 0;

  for (const [uid, devices] of byUser) {
    let payload: { title: string; body: string };
    try {
      const snap = await userSnapshot(db, uid);
      payload = morningFor(snap, nameOf.get(uid) ?? null);
    } catch {
      payload = FALLBACK;
    }
    const full = { ...payload, url: "/coach", tag: "morning" };

    for (const d of devices) {
      try {
        const r = await sendPush({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, full);
        if (r.gone) {
          await db.from("push_subscriptions").delete().eq("endpoint", d.endpoint);
          removed++;
        } else if (r.ok) {
          sent++;
        }
      } catch {
        /* یک اشتراکِ خراب نباید بقیه را متوقف کند */
      }
    }
  }

  return NextResponse.json({ ok: true, users: byUser.size, sent, removed });
}

export const GET = handle;
export const POST = handle;
