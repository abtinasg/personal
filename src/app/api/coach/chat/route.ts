import { NextResponse } from "next/server";
import { authed, bad } from "@/lib/api";
import { guardAI } from "@/lib/aiGuard";
import { isEnabled } from "@/lib/flags";
import { streamText, type AIMessage } from "@/lib/openrouter";
import { getCachedSnapshot, refreshSnapshot } from "@/lib/coach";
import type { getServiceClient } from "@/lib/supabase";
import { captureFromText, captureMealFromImage, looksLikeIntake, type SavedItem } from "@/lib/capture";

type DB = ReturnType<typeof getServiceClient>;

export const runtime = "nodejs";

const enc = new TextEncoder();
function sse(event: string, data: unknown): Uint8Array {
  return enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * ثبتِ «بهترین تلاشِ» آیتم‌های پیامِ کاربر (غذا/خرج/متریک) با یک فراخوانیِ LLM.
 * این تابع *به‌موازاتِ* استریمِ چت اجرا می‌شود، نه قبل از آن — پس هیچ‌وقت TTFT را
 * عقب نمی‌اندازد. خروجی‌اش بعداً به‌صورتِ رویدادِ SSE «saved» به کلاینت می‌رسد.
 */
async function runCapture(
  db: DB,
  uid: string,
  lastUser: string,
  image: string
): Promise<SavedItem[]> {
  try {
    if (image) {
      const res = await captureMealFromImage(db, uid, image, lastUser);
      return res?.saved ?? [];
    }
    if (looksLikeIntake(lastUser)) {
      const res = await captureFromText(db, uid, lastUser);
      return res?.saved ?? [];
    }
  } catch {
    /* best-effort — capture نباید چت را بشکند */
  }
  return [];
}

export async function POST(req: Request) {
  // تایمینگ برای دیدنِ اثرِ stream-first: t0 = شروعِ هندلر. از performance.now()
  // استفاده می‌کنیم نه console.time با لیبلِ ثابت، چون لیبل بینِ درخواست‌های هم‌زمان
  // قاطی می‌شود. آخرِ کار یک خطِ خلاصه لاگ می‌کنیم: before_stream / ttft / total.
  const t0 = performance.now();

  // ─────────────────────────────────────────────────────────────────────────
  // A) مسیرِ بحرانی (CRITICAL PATH): فقط کارِ سریع و لازم، بعد فوراً stream.
  //    هیچ کوئریِ سنگین یا فراخوانیِ LLM این‌جا await نمی‌شود.
  // ─────────────────────────────────────────────────────────────────────────

  // (۱) احرازِ هویتِ سبک — یک SELECTِ ایندکس‌دار روی users (لازم برای امنیت/FK).
  const a = await authed();
  if ("error" in a) return a.error;

  // (۲) کلیدِ قطعِ هوش مصنوعی — تنها گیتِ روی مسیرِ بحرانی. کش‌شده (~۳۰ث، بدونِ
  //     round-trip در حالتِ داغ) و همان فلگی است که پایشِ بودجه هنگام پر شدنِ سقف
  //     می‌اندازد. بقیه‌ی منطقِ guard (سهمیه/نرخ/لاگ) به پس‌زمینه می‌رود.
  if (!(await isEnabled(a.db, "ai_enabled"))) {
    return NextResponse.json(
      { error: "هوش مصنوعیِ جوانه موقتاً غیرفعاله؛ کمی بعد دوباره امتحان کن. 🌱", code: "AI_DISABLED" },
      { status: 503 }
    );
  }

  const b = await req.json().catch(() => ({}));
  const incoming = Array.isArray(b.messages) ? b.messages : [];
  const history: AIMessage[] = incoming
    .filter((m: any) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string")
    .slice(-8)
    .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 1000) }));

  if (!history.length || history[history.length - 1].role !== "user") {
    return bad("پیام معتبر لازم است.");
  }

  const lastUser = history[history.length - 1].content as string;
  const image = typeof b.image === "string" && b.image.trim() ? b.image.trim() : "";

  // (۳) snapshot فقط از کشِ کوتاه‌مدت خوانده می‌شود (همگام، بدونِ دیتابیس). در صورتِ
  //     نبودِ کش، context عمومی است و در پس‌زمینه برای نوبتِ بعد تازه می‌شود.
  const snap = getCachedSnapshot(a.uid);
  const snapText = snap?.hasData ? snap.text : "هنوز هویت/عادت/ماموریتی نساخته.";

  const messages: AIMessage[] = [
    {
      role: "system",
      content:
        "تو «جوانه»‌ای، مربیِ شخصیِ کاربر. فارسیِ گرم و صمیمی («تو»)، هم‌قدم نه معلم، هیچ‌وقت سرزنش نمی‌کنی — اگه چیزی جا موند: «دیروز نشد؟ امروز هست». بُردهای کوچیک رو جشن می‌گیری.\n" +
        "فلسفه‌ی «عادت‌های اتمی»: هویت مهم‌تر از هدف، ثبات مهم‌تر از شدت، هیچ‌وقت دو بار جا ننداز، قانون ۲ دقیقه. هدفِ بزرگ رو همون‌جا به قدمِ کوچیکِ امروز بشکن.\n" +
        "اگه کاربر چیزی که خورده یا خرج کرده گفت، انگار خودت پشتِ صحنه ثبتش کردی صحبت کن.\n" +
        "۲ تا ۴ جمله، عملی، با دادهٔ واقعی کاربر. حداکثر یک 🌱، بدون Markdown.\n\n" +
        "وضعیتِ فعلیِ کاربر:\n" +
        snapText,
    },
    ...history,
  ];

  // پایانِ مسیرِ بحرانی: این عدد باید بعد از refactor خیلی کوچک باشد (فقط auth +
  // گیتِ فلگ + خواندنِ کشِ snapshot)، نه ثانیه‌هایی که قبلاً capture/snapshot می‌برد.
  const beforeStreamMs = performance.now() - t0;

  // ─────────────────────────────────────────────────────────────────────────
  // B) STREAM-FIRST: استریم فوراً برمی‌گردد. هر side-effect به‌موازاتِ توکن‌ها
  //    اجرا می‌شود و قبل از بستنِ استریم تضمیناً تمام می‌شود (بدونِ از دست رفتنِ نوشتن).
  // ─────────────────────────────────────────────────────────────────────────
  const stream = new ReadableStream({
    async start(controller) {
      // کارهای پس‌زمینه که هم‌زمان با استریمِ چت اجرا می‌شوند (نه قبل از آن).
      const background: Promise<unknown>[] = [];
      let ttftMs = -1; // زمانِ اولین توکن (TTFT) — نکته‌ی اصلیِ این refactor.

      // capture (فراخوانیِ LLM) — هم‌پوشانِ کاملِ استریمِ چت؛ هیچ تأثیری روی TTFT ندارد.
      // به‌محضِ آماده‌شدن، رویدادِ `saved` را تزریق می‌کنیم (async-fill).
      const savedEmit = runCapture(a.db, a.uid, lastUser, image)
        .then((saved) => {
          try {
            controller.enqueue(sse("saved", { saved }));
          } catch {
            /* استریم بسته شده — نادیده بگیر */
          }
        })
        .catch(() => {});
      background.push(savedEmit);

      // guard/سهمیه/لاگِ ai_usage — کاملاً پس‌زمینه و best-effort (نوشتنِ مصرف حفظ می‌شود).
      background.push(guardAI(a.db, a.uid, "coach_chat").catch(() => {}));

      // تازه‌سازیِ snapshot — کش را برای نوبتِ بعد گرم می‌کند؛ خارج از مسیرِ بحرانی.
      background.push(refreshSnapshot(a.db, a.uid).catch(() => {}));

      try {
        for await (const token of streamText(messages, { temperature: 0.7, maxTokens: 400 })) {
          if (ttftMs < 0) ttftMs = performance.now() - t0; // اولین توکن رسید
          controller.enqueue(sse("token", token));
        }
        controller.enqueue(sse("done", {}));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "مربی الان نتونست جواب بده.";
        controller.enqueue(sse("error", { message: msg }));
      } finally {
        // اطمینان از پایانِ side-effectها قبل از بستنِ استریم تا هیچ نوشتنی گم نشود.
        // این‌ها هم‌زمان با توکن‌ها اجرا شده‌اند، پس معمولاً همین حالا تمام‌اند.
        await Promise.allSettled(background);
        const totalMs = performance.now() - t0;
        // (الف) لاگِ سرور.
        console.log(
          `[coach/chat timing] before_stream=${beforeStreamMs.toFixed(1)}ms ` +
            `ttft=${ttftMs < 0 ? "n/a" : ttftMs.toFixed(1) + "ms"} ` +
            `total=${totalMs.toFixed(1)}ms`
        );
        // (ب) برای مرورگر: همین اعداد را به‌صورتِ رویدادِ SSE می‌فرستیم تا کلاینت
        //     بتواند در کنسولِ devtools چاپشان کند (console.logِ سرور آن‌جا دیده نمی‌شود).
        try {
          controller.enqueue(
            sse("timing", {
              before_stream_ms: Math.round(beforeStreamMs),
              ttft_ms: ttftMs < 0 ? null : Math.round(ttftMs),
              total_ms: Math.round(totalMs),
            })
          );
        } catch {
          /* استریم بسته شده */
        }
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
