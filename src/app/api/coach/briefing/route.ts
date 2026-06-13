import { authed, ok, bad } from "@/lib/api";
import { guardAI } from "@/lib/aiGuard";
import { aiText } from "@/lib/openrouter";
import { userSnapshot } from "@/lib/coach";
import { getCached, setCached, secondsUntilMidnight } from "@/lib/aiCache";
import { todayISO } from "@/lib/format";

export const runtime = "nodejs";

export async function GET() {
  const a = await authed();
  if ("error" in a) return a.error;

  const today = todayISO();
  const cacheKey = `briefing:${a.uid}:${today}`;

  const cached = await getCached<{ briefing: string; hasData: boolean }>(a.db, cacheKey);
  if (cached) return ok(cached);

  const guard = await guardAI(a.db, a.uid, "coach_briefing");
  if ("error" in guard) return guard.error;

  const snap = await userSnapshot(a.db, a.uid);
  if (!snap.hasData) {
    const payload = { briefing: "هنوز هویت یا عادتی نساختی. با ساختن اولین ماموریت شروع کن تا هر روز یک قدم به آدمی که می‌خوای بشی نزدیک‌تر بشی.", hasData: false };
    await setCached(a.db, cacheKey, payload, secondsUntilMidnight());
    return ok(payload);
  }

  try {
    const briefing = await aiText(
      [
        {
          role: "system",
          content:
            "تو یک مربیِ گرم و الهام‌بخش بر پایه‌ی «عادت‌های اتمی» هستی و فارسی حرف می‌زنی. " +
            "بر اساس وضعیتِ امروزِ کاربر، یک بریفینگِ صبحگاهیِ کوتاه (حداکثر ۲ تا ۳ جمله) بنویس. " +
            "اگر دیروز عادتی جا مونده، با ملایمت و بر اساس قانون «هیچ‌وقت دوبار جا ننداز» تشویقش کن (بدون سرزنش). " +
            "اگر ماموریت فعال داره بهش وصلش کن. لحن شخصی و انگیزشی باشه، نه کلیشه‌ای. بدون Markdown و بدون ایموجی.",
        },
        { role: "user", content: snap.text },
      ],
      { temperature: 0.7, maxTokens: 150, tag: "coach_briefing" }
    );
    const payload = { briefing: briefing.trim(), hasData: true };
    await setCached(a.db, cacheKey, payload, secondsUntilMidnight());
    return ok(payload);
  } catch (e) {
    return bad(e instanceof Error ? e.message : "تهیه‌ی بریفینگ با خطا روبه‌رو شد.", 502);
  }
}
