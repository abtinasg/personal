import { authed, bad } from "@/lib/api";
import { guardAI } from "@/lib/aiGuard";
import { streamText, type AIMessage } from "@/lib/openrouter";
import { userSnapshot } from "@/lib/coach";
import { captureFromText, captureMealFromImage, looksLikeIntake, type SavedItem } from "@/lib/capture";

export const runtime = "nodejs";

const enc = new TextEncoder();
function sse(event: string, data: unknown): Uint8Array {
  return enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function POST(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const guard = await guardAI(a.db, a.uid, "coach_chat");
  if ("error" in guard) return guard.error;
  const b = await req.json().catch(() => ({}));

  const incoming = Array.isArray(b.messages) ? b.messages : [];
  const history: AIMessage[] = incoming
    .filter((m: any) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string")
    .slice(-10)
    .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 1000) }));

  if (!history.length || history[history.length - 1].role !== "user") {
    return bad("پیام معتبر لازم است.");
  }

  const lastUser = history[history.length - 1].content as string;
  const image = typeof b.image === "string" && b.image.trim() ? b.image.trim() : "";
  let saved: SavedItem[] = [];
  let captureNote = "";

  if (image) {
    const res = await captureMealFromImage(a.db, a.uid, image, lastUser).catch(() => null);
    if (res) {
      saved = res.saved;
      if (!saved.length && res.note) captureNote = res.note;
    }
  } else if (looksLikeIntake(lastUser)) {
    const res = await captureFromText(a.db, a.uid, lastUser).catch(() => null);
    if (res) saved = res.saved;
  }

  const snap = await userSnapshot(a.db, a.uid);

  const savedNote = saved.length
    ? "\n\nهمین الان این موارد رو از پیامِ کاربر برای امروزش ثبت کردی: " +
      saved.map((s) => s.label).join("، ") +
      ". اول کوتاه و گرم تأیید کن که ثبت شد، بعد یه نکته‌ی کوتاهِ مفید یا تشویق بده."
    : captureNote
      ? `\n\nکاربر یه عکس فرستاد ولی نتونستی غذایی توش ثبت کنی. با مهربونی بهش بگو: «${captureNote}»`
      : image
        ? "\n\nکاربر یه عکس فرستاد. اگه غذا بود ثبتش کردی؛ کوتاه و گرم راهنماییش کن."
        : "";

  const messages: AIMessage[] = [
    {
      role: "system",
      content:
        "تو «جوانه»‌ای — مربیِ شخصیِ کاربر در این اپ. فقط فارسیِ گرم و صمیمی («تو») حرف می‌زنی و خودت رو جوانه معرفی می‌کنی. " +
        "شخصیتت: هم‌قدمِ کاربری، نه معلم. هیچ‌وقت سرزنش نمی‌کنی؛ اگه دیروز کاری جا موند می‌گی «دیروز نشد؟ امروز هست». بُردهای کوچیک رو جشن می‌گیری و وقتِ کاربر رو با جمله‌های کوتاه محترم می‌شمری. " +
        "فلسفه‌ات بر پایه‌ی «عادت‌های اتمی» جیمز کلیر: هدف مهم نیست، هویت مهمه؛ هر عادتِ کوچک یک رأیه به آدمی که کاربر می‌خواد بشه؛ ثبات از شدت مهم‌تره؛ هیچ‌وقت دوبار جا ننداز؛ قانون ۲ دقیقه. " +
        "وقتی کاربر یه هدفِ بزرگ می‌گه، همون لحظه بشکنش به چند قدمِ کوچیکِ امروز — اون‌قدر کوچیک که نشه نه گفت. " +
        "کاربر می‌تونه چیزی که خورده یا خرج کرده رو بهت بگه؛ تو پشتِ صحنه ثبتش می‌کنی — پس طوری حرف بزن که انگار خودت ثبتش کردی. " +
        "کوتاه، مشخص و عملی جواب بده (معمولاً ۲ تا ۴ جمله). از دادهٔ واقعیِ کاربر استفاده کن. حداکثر یک ایموجی (ترجیحاً 🌱) و بدون Markdown سنگین.\n\n" +
        "وضعیتِ فعلیِ کاربر:\n" +
        (snap.hasData ? snap.text : "هنوز هویت/عادت/ماموریتی نساخته.") +
        savedNote,
    },
    ...history,
  ];

  const stream = new ReadableStream({
    async start(controller) {
      // متادیتای ثبت‌شده‌ها را فوری بفرست تا client منتظر stream کامل نشود
      controller.enqueue(sse("saved", { saved }));
      try {
        for await (const token of streamText(messages, { temperature: 0.7, maxTokens: 400 })) {
          controller.enqueue(sse("token", token));
        }
        controller.enqueue(sse("done", {}));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "مربی الان نتونست جواب بده.";
        controller.enqueue(sse("error", { message: msg }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      // به nginx/HAProxy می‌گوید response را buffer نکند — ضروری برای Arvan
      "X-Accel-Buffering": "no",
    },
  });
}
