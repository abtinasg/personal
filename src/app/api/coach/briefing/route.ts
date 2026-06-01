import { authed, ok, bad } from "@/lib/api";
import { aiText } from "@/lib/openrouter";
import { userSnapshot } from "@/lib/coach";

export const runtime = "nodejs";

export async function GET() {
  const a = await authed();
  if ("error" in a) return a.error;

  const snap = await userSnapshot(a.db, a.uid);
  if (!snap.hasData) {
    return ok({ briefing: "هنوز هویت یا عادتی نساختی. با ساختن اولین ماموریت شروع کن تا هر روز یک قدم به آدمی که می‌خوای بشی نزدیک‌تر بشی.", hasData: false });
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
      { temperature: 0.7, maxTokens: 220 }
    );
    return ok({ briefing: briefing.trim(), hasData: true });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "تهیه‌ی بریفینگ با خطا روبه‌رو شد.", 502);
  }
}
