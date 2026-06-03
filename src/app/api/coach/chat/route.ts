import { authed, ok, bad } from "@/lib/api";
import { aiText, type AIMessage } from "@/lib/openrouter";
import { userSnapshot } from "@/lib/coach";
import { captureFromText, captureMealFromImage, looksLikeIntake, type SavedItem } from "@/lib/capture";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const b = await req.json().catch(() => ({}));

  const incoming = Array.isArray(b.messages) ? b.messages : [];
  // فقط نقش‌های مجاز و آخرین ۱۰ پیام
  const history: AIMessage[] = incoming
    .filter((m: any) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string")
    .slice(-10)
    .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 1000) }));

  if (!history.length || history[history.length - 1].role !== "user") {
    return bad("پیام معتبر لازم است.");
  }

  // اگه کاربر داره چیزی که خورده/خرج‌کرده/اندازه‌گرفته رو می‌گه، همین‌جا ثبتش کن.
  const lastUser = history[history.length - 1].content as string;
  const image = typeof b.image === "string" && b.image.trim() ? b.image.trim() : "";
  let saved: SavedItem[] = [];
  let captureNote = "";
  if (image) {
    // عکسِ غذا: با مدلِ vision تشخیص بده و ثبتش کن.
    const res = await captureMealFromImage(a.db, a.uid, image, lastUser).catch(() => null);
    if (res) {
      saved = res.saved;
      if (!saved.length && res.note) captureNote = res.note;
    }
  } else if (looksLikeIntake(lastUser)) {
    const res = await captureFromText(a.db, a.uid, lastUser).catch(() => null);
    if (res) saved = res.saved;
  }

  // عکسِ وضعیت بعد از ثبت گرفته می‌شه تا کالریِ امروز به‌روز باشه.
  const snap = await userSnapshot(a.db, a.uid);

  const savedNote = saved.length
    ? "\n\nهمین الان این موارد رو از پیامِ کاربر برای امروزش ثبت کردی: " +
      saved.map((s) => s.label).join("، ") +
      ". اول کوتاه و گرم تأیید کن که ثبت شد، بعد یه نکته‌ی کوتاهِ مفید یا تشویق بده (مثلاً درباره‌ی کالری یا تعادلِ روز)."
    : captureNote
      ? `\n\nکاربر یه عکس فرستاد ولی نتونستی غذایی توش ثبت کنی. با مهربونی این رو بهش بگو: «${captureNote}»`
      : image
        ? "\n\nکاربر یه عکس فرستاد. اگه غذا بود ثبتش کردی؛ کوتاه و گرم راهنماییش کن."
        : "";

  try {
    const reply = await aiText(
      [
        {
          role: "system",
          content:
            "تو «مربیِ» شخصیِ کاربر در یک اپِ هویت‌محور بر پایه‌ی کتاب «عادت‌های اتمی» جیمز کلیر هستی و فقط فارسی و گرم حرف می‌زنی. " +
            "فلسفه‌ات: هدف مهم نیست، هویت مهمه؛ هر عادتِ کوچک یک رأیه به آدمی که کاربر می‌خواد بشه؛ ثبات از شدت مهم‌تره؛ هیچ‌وقت دوبار جا ننداز؛ قانون ۲ دقیقه. " +
            "کاربر می‌تونه چیزی که خورده یا خرج کرده رو بهت بگه؛ تو پشتِ صحنه ثبتش می‌کنی — پس طوری حرف بزن که انگار خودت ثبتش کردی. " +
            "کوتاه، مشخص و عملی جواب بده (معمولاً ۲ تا ۴ جمله). از دادهٔ واقعیِ کاربر استفاده کن و وقتی مرتبطه به اسمِ هویت‌ها/ماموریت/عادت‌ها و جایزه‌هاش اشاره کن. سرزنش نکن؛ با مهربونی هل بده جلو. بدون Markdown سنگین.\n\n" +
            "وضعیتِ فعلیِ کاربر:\n" +
            (snap.hasData ? snap.text : "هنوز هویت/عادت/ماموریتی نساخته.") +
            savedNote,
        },
        ...history,
      ],
      { temperature: 0.7, maxTokens: 400 }
    );
    return ok({ reply: reply.trim(), saved });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "مربی الان نتونست جواب بده.", 502);
  }
}
