// base URL ارائه‌دهنده‌ی AI (هر سرویسِ OpenAI-compatible: OpenRouter، AvalAI، Arvan Gateway و …).
// پیش‌فرض OpenRouter است؛ روی پروداکشنِ آروان به gateway آروان سوییچ می‌کنیم تا از فیلترینگ رد نشویم.
// کاربر می‌تونه /v1 رو بذاره یا نذاره — هر دو حالت کار می‌کنه.
const RAW_BASE = (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api").replace(/\/+$/, "");
const BASE_URL = /\/v\d+$/.test(RAW_BASE) ? RAW_BASE : `${RAW_BASE}/v1`;
const ENDPOINT = `${BASE_URL}/chat/completions`;
const DEFAULT_MODEL = "openai/gpt-4o-mini";

/** بخش‌های یک پیامِ چندوجهی (متن + تصویر) برای مدل‌های vision. */
export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type AIMessage = { role: "system" | "user" | "assistant"; content: string | ContentPart[] };

function apiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error(
      "کلید AI تنظیم نشده. OPENROUTER_API_KEY را در فایل .env قرار بده و سرور را ری‌استارت کن."
    );
  }
  return key;
}

// برای مسیرهای همزمان (مثل چت) این timeout باید کمتر از timeout پراکسی Arvan باشد.
// برای مسیرهای async (مثل تولید برنامه‌ی ورزشی) می‌توان مقدار بزرگ‌تری داد.
// مقدار پیش‌فرض ۲۵ ثانیه است تا error handler ما قبل از پراکسی اجرا شود.
const DEFAULT_TIMEOUT_MS = Number(process.env.OPENROUTER_TIMEOUT_MS) || 25_000;

// اگر مدلِ اصلی کُند بود، بعد از FALLBACK_DELAY_MS ثانیه یک درخواستِ موازی با مدلِ سریع‌تر می‌فرستیم.
// هر کدام اول جواب دادند برنده می‌شوند. با خالی گذاشتن OPENROUTER_FALLBACK_MODEL غیرفعال می‌شود.
const FALLBACK_MODEL = process.env.OPENROUTER_FALLBACK_MODEL ?? "";
const FALLBACK_DELAY_MS = Number(process.env.OPENROUTER_FALLBACK_DELAY_MS) || 9_000;

async function call(
  messages: AIMessage[],
  opts: {
    json?: boolean;
    temperature?: number;
    maxTokens?: number;
    seed?: number;
    timeoutMs?: number;
    model?: string;
  } = {}
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
        "X-Title": "Yek-Darsad",
      },
      body: JSON.stringify({
        model: opts.model ?? (process.env.OPENROUTER_MODEL || DEFAULT_MODEL),
        messages,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens ?? 800,
        // seed باعث می‌شه ورودیِ یکسان خروجیِ پایدار بده (مثلاً تخمینِ کالریِ یک عکس هر بار یکی باشه).
        ...(opts.seed != null ? { seed: opts.seed } : {}),
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: controller.signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("هوش مصنوعی به‌موقع پاسخ نداد. لطفاً دوباره تلاش کن.");
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[openrouter] provider error", res.status, detail.slice(0, 500));
    throw new Error("سرویسِ هوش مصنوعی الان در دسترس نیست. لطفاً دوباره تلاش کن.");
  }

  const data = await res.json().catch(() => null);
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("پاسخ نامعتبر از هوش مصنوعی دریافت شد.");
  }
  return content;
}

/**
 * مدلِ اصلی را صدا می‌زند؛ اگر OPENROUTER_FALLBACK_MODEL تنظیم باشد و اصلی کُند باشد،
 * بعد از FALLBACK_DELAY_MS یک درخواستِ موازی ارسال می‌شود و هر کدام اول برگشتند استفاده می‌شود.
 */
function raceWithFallback(
  messages: AIMessage[],
  opts: Parameters<typeof call>[1]
): Promise<string> {
  if (!FALLBACK_MODEL) return call(messages, opts);

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const win = (v: string) => { if (!settled) { settled = true; resolve(v); } };
    const lose = (e: unknown) => { if (!settled) { settled = true; reject(e); } };

    const timer = setTimeout(() => {
      if (settled) return;
      call(messages, { ...opts, model: FALLBACK_MODEL }).then(win).catch(lose);
    }, FALLBACK_DELAY_MS);

    call(messages, opts)
      .then((v) => { clearTimeout(timer); win(v); })
      .catch((e) => {
        // اصلی شکست خورد — فوری fallback را استارت می‌زنیم (اگر هنوز شروع نشده)
        clearTimeout(timer);
        if (settled) return;
        call(messages, { ...opts, model: FALLBACK_MODEL }).then(win).catch(lose);
      });
  });
}

/** یک پاسخ متنی آزاد از مدل می‌گیرد. */
export async function aiText(
  messages: AIMessage[],
  opts?: { temperature?: number; maxTokens?: number; seed?: number; timeoutMs?: number }
): Promise<string> {
  return raceWithFallback(messages, opts);
}

/** از مدل می‌خواهد فقط JSON بدهد و آن را parse می‌کند. */
export async function aiJSON<T>(
  messages: AIMessage[],
  opts?: { temperature?: number; maxTokens?: number; seed?: number; timeoutMs?: number }
): Promise<T> {
  const raw = await raceWithFallback(messages, { ...opts, json: true });
  return parseJSON<T>(raw);
}

/**
 * توکن‌های متنی را از OpenRouter یکی‌یکی yield می‌کند.
 * چون داده مداوم روی connection جاری است، reverse-proxy ایران
 * idle timeout نمی‌زند — 502/504 چت حل می‌شود.
 */
export async function* streamText(
  messages: AIMessage[],
  opts?: { temperature?: number; maxTokens?: number; timeoutMs?: number }
): AsyncGenerator<string> {
  const controller = new AbortController();
  // timeout فقط تا دریافتِ اولین بایت از سرور — بعد از آن connection زنده است
  const timeoutId = setTimeout(() => controller.abort(), opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
        "X-Title": "Yek-Darsad",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
        messages,
        temperature: opts?.temperature ?? 0.7,
        max_tokens: opts?.maxTokens ?? 400,
        stream: true,
      }),
      signal: controller.signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("هوش مصنوعی به‌موقع پاسخ نداد. لطفاً دوباره تلاش کن.");
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[openrouter] stream provider error", res.status, detail.slice(0, 500));
    throw new Error("سرویسِ هوش مصنوعی الان در دسترس نیست. لطفاً دوباره تلاش کن.");
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (raw === "[DONE]") return;
        try {
          const token = (JSON.parse(raw) as { choices?: { delta?: { content?: string } }[] })
            ?.choices?.[0]?.delta?.content;
          if (typeof token === "string" && token) yield token;
        } catch { /* خط ناقص — ادامه */ }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function parseJSON<T>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error("نتوانستم پاسخ هوش مصنوعی را به‌صورت JSON بخوانم.");
  }
}
