/**
 * stream-first: guardAI (1 RTT) → snapshot از کش (صفر I/O) → streamText فوراً
 * capture موازی اجرا می‌شود و نتیجه‌اش با event «saved» تزریق می‌شود.
 * استثنا: برای عکس تا ۶ ثانیه صبرِ نرم — تا جوابِ مدل بتواند به غذا اشاره کند.
 */
import { authed, bad } from "@/lib/api";
import { guardAI } from "@/lib/aiGuard";
import { getCachedSnapshot, refreshSnapshot } from "@/lib/coach";
import {
  captureFromText,
  captureMealFromImage,
  looksLikeIntake,
  type CaptureResult,
} from "@/lib/capture";
import { streamText, type AIMessage } from "@/lib/openrouter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatBody = {
  message?: string;
  image?: string;
  history?: { role: "user" | "assistant"; content: string }[];
  // سازگاری با فرمتِ قدیمی (messages array)
  messages?: { role: "user" | "assistant"; content: string }[];
};

function buildSystemPrompt(snapText: string | null): string {
  return [
    "تو «جوانه»‌ای، مربیِ شخصیِ کاربر. فارسیِ گرم و صمیمی («تو»)، هم‌قدم نه معلم، هیچ‌وقت سرزنش نمی‌کنی — اگه چیزی جا موند: «دیروز نشد؟ امروز هست». بُردهای کوچیک رو جشن می‌گیری.\n" +
    "فلسفه‌ی «عادت‌های اتمی»: هویت مهم‌تر از هدف، ثبات مهم‌تر از شدت، هیچ‌وقت دو بار جا ننداز، قانون ۲ دقیقه. هدفِ بزرگ رو همون‌جا به قدمِ کوچیکِ امروز بشکن.\n" +
    "اگه پیامِ کاربر شبیهِ گزارش/ثبت بود (غذا، خرج، آب، وزن...)، فرض کن سیستمِ ثبتِ خودکار جداگانه ذخیره‌اش می‌کند؛ تو فقط کوتاه واکنش نشان بده — جزئیاتِ ثبت را خودت اختراع نکن.\n" +
    "۲ تا ۴ جمله، عملی، با دادهٔ واقعی کاربر. حداکثر یک 🌱، بدون Markdown.",
    snapText ? `وضعیتِ فعلیِ کاربر:\n${snapText.slice(0, 1200)}` : "هنوز هویت/عادت/ماموریتی نساخته.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

const sleep = (ms: number) => new Promise<null>((r) => setTimeout(() => r(null), ms));

const enc = new TextEncoder();
function sse(event: string, data: unknown): Uint8Array {
  return enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function POST(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const { uid, db } = a;

  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return bad("بدنه‌ی درخواست نامعتبر است.");
  }

  const g = await guardAI(db, uid, "coach_chat");
  if ("error" in g) return g.error;

  // پشتیبانی از هر دو فرمت ارسال پیام
  const rawHistory = Array.isArray(body.history)
    ? body.history
    : Array.isArray(body.messages)
      ? body.messages
      : [];
  const message = body.message
    ? String(body.message).trim().slice(0, 1000)
    : rawHistory.length
      ? String(rawHistory[rawHistory.length - 1]?.content || "").trim().slice(0, 1000)
      : "";
  const image = typeof body.image === "string" ? body.image.trim() : "";
  if (!message && !image) return bad("پیامی نفرستادی.");

  // ── ① snapshot: از کش (صفر کوئری در مسیرِ بحرانی)؛ تازه‌سازی در پس‌زمینه ──
  const snap = getCachedSnapshot(uid);
  void refreshSnapshot(db, uid).catch(() => {});

  // ── ② capture: شروع موازی، استریم را بلاک نمی‌کند ──
  const capturePromise: Promise<CaptureResult | null> = image
    ? captureMealFromImage(db, uid, image, message)
    : message && looksLikeIntake(message)
      ? captureFromText(db, uid, message)
      : Promise.resolve(null);
  capturePromise.catch(() => null);

  // برای عکس، تا ۶ ثانیه صبرِ نرم
  let preCapture: CaptureResult | null = null;
  if (image) {
    preCapture = await Promise.race([capturePromise, sleep(6000)]).catch(() => null);
  }

  const history = rawHistory
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-8)
    .map((h): AIMessage => ({ role: h.role, content: String(h.content || "").slice(0, 1000) }));

  const messages: AIMessage[] = [
    { role: "system", content: buildSystemPrompt(snap?.text ?? null) },
    ...(preCapture?.saved.length
      ? [{
          role: "system" as const,
          content: `همین الان از روی پیام/عکسِ کاربر ثبت شد: ${preCapture.saved.map((s) => s.label).join("؛ ")}. در جوابت کوتاه به آن اشاره کن.`,
        }]
      : []),
    ...history,
    { role: "user", content: message || "این عکس رو برات فرستادم." },
  ];

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try { controller.enqueue(sse(event, data)); } catch { closed = true; }
      };

      let savedSent = false;
      const emitSaved = (r: CaptureResult | null) => {
        if (!r || savedSent) return;
        if (r.saved.length || r.note) {
          send("saved", { saved: r.saved, note: r.note ?? null });
          savedSent = true;
        }
      };

      emitSaved(preCapture);
      void capturePromise.then(emitSaved, () => {});

      try {
        for await (const token of streamText(messages, { temperature: 0.7, maxTokens: 400 })) {
          send("token", { t: token });
        }

        const late = await Promise.race([capturePromise, sleep(800)]).catch(() => null);
        emitSaved(late);

        send("done", {});
      } catch (e) {
        send("error", { message: e instanceof Error ? e.message : "خطا در گفتگو با مربی." });
      } finally {
        closed = true;
        try { controller.close(); } catch { /* قبلاً بسته شده */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
