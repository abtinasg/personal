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

async function call(
  messages: AIMessage[],
  opts: {
    json?: boolean;
    temperature?: number;
    maxTokens?: number;
    seed?: number;
    timeoutMs?: number;
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
        model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
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
    throw new Error(`خطا از OpenRouter (${res.status}): ${detail.slice(0, 300)}`);
  }

  const data = await res.json().catch(() => null);
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("پاسخ نامعتبر از هوش مصنوعی دریافت شد.");
  }
  return content;
}

/** یک پاسخ متنی آزاد از مدل می‌گیرد. */
export async function aiText(
  messages: AIMessage[],
  opts?: { temperature?: number; maxTokens?: number; seed?: number; timeoutMs?: number }
): Promise<string> {
  return call(messages, opts);
}

/** از مدل می‌خواهد فقط JSON بدهد و آن را parse می‌کند. */
export async function aiJSON<T>(
  messages: AIMessage[],
  opts?: { temperature?: number; maxTokens?: number; seed?: number; timeoutMs?: number }
): Promise<T> {
  const raw = await call(messages, { ...opts, json: true });
  return parseJSON<T>(raw);
}

/**
 * توکن‌های متنی را از ارائه‌دهنده یکی‌یکی yield می‌کند.
 * اگر `OPENROUTER_STREAM=0` باشد (مثلاً gateway آروان که SSE پشتیبانی نمی‌کند)،
 * یک non-stream call می‌زند و کلِ پاسخ را به‌صورت یک chunk بزرگ yield می‌کند —
 * UI استریم نمی‌بیند ولی حداقل کار می‌کند و پشتِ پراکسی هنگ نمی‌زند.
 */
export async function* streamText(
  messages: AIMessage[],
  opts?: { temperature?: number; maxTokens?: number; timeoutMs?: number }
): AsyncGenerator<string> {
  if (process.env.OPENROUTER_STREAM === "0" || process.env.OPENROUTER_STREAM === "false") {
    const full = await call(messages, opts);
    if (full) yield full;
    return;
  }

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
    throw new Error(`خطا از OpenRouter (${res.status}): ${detail.slice(0, 300)}`);
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
