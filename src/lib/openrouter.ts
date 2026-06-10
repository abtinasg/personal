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

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey()}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
    "X-Title": "Amrooz",
  };
}

// سقفِ کلِ انتظار (باید کمتر از timeout پراکسیِ آروان باشد تا error handler ما اول اجرا شود).
const DEFAULT_TIMEOUT_MS = Number(process.env.OPENROUTER_TIMEOUT_MS) || 25_000;

// تایم‌اوتِ «فازِ اتصال» (تا رسیدنِ هدرها). روی مسیرِ فیلترشده/cross-border اغلب
// خودِ connect است که گیر می‌کند؛ به‌جای ۲۵ ثانیه انتظار، بعد از این مدت قطع و
// یک‌بار دیگر تلاش می‌کنیم (forensics §3 رتبه‌ی ۵ — «بدونِ retry، صفر تاب‌آوری»).
const CONNECT_TIMEOUT_MS = Number(process.env.OPENROUTER_CONNECT_TIMEOUT_MS) || 8_000;
const RETRY_DELAY_MS = 350;

/**
 * اتصال با «حداکثر یک تلاشِ دوباره»، فقط در فازِ connect:
 *   • تلاشِ اول با تایم‌اوتِ کوتاه (CONNECT_TIMEOUT_MS)
 *   • روی AbortError / خطای شبکه / 5xx / 429 → یک تلاشِ دیگر با بودجه‌ی کامل
 *   • 4xxِ واقعی (کلیدِ نامعتبر، مدلِ اشتباه و …) → بدونِ تکرار، خطا بالا می‌رود
 *
 * تایم‌اوت فقط تا دریافتِ هدرهاست؛ بعد از آن استریم آزاد است (رفتارِ قبلی حفظ شده).
 * چون retry فقط وقتی رخ می‌دهد که هنوز هیچ بایتی نیامده، ریسکِ تولید/صورتحسابِ
 * دوباره عملاً صفر است.
 */
async function connectWithRetry(
  payload: Record<string, unknown>,
  timeoutMs: number
): Promise<Response> {
  let lastErr: unknown = null;

  for (let attempt = 0; attempt <= 1; attempt++) {
    const controller = new AbortController();
    const budget = attempt === 0 ? Math.min(CONNECT_TIMEOUT_MS, timeoutMs) : timeoutMs;
    const tid = setTimeout(() => controller.abort(), budget);

    let res: Response | null = null;
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (e) {
      lastErr =
        e instanceof Error && e.name === "AbortError"
          ? new Error("هوش مصنوعی به‌موقع پاسخ نداد. لطفاً دوباره تلاش کن.")
          : e;
    } finally {
      // مثل نسخه‌ی قبل: تایمر فقط تا هدرها زنده است؛ بدنه/استریم را نمی‌کشد.
      clearTimeout(tid);
    }

    if (res) {
      if (res.ok) return res;
      const detail = await res.text().catch(() => "");
      const err = new Error(`خطا از OpenRouter (${res.status}): ${detail.slice(0, 300)}`);
      if (res.status < 500 && res.status !== 429) throw err; // 4xx واقعی — تکرار بی‌فایده
      lastErr = err; // 5xx/429 — قابلِ تکرار
    }

    if (attempt === 0) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
  }

  throw lastErr instanceof Error ? lastErr : new Error("اتصال به هوش مصنوعی برقرار نشد.");
}

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
  const res = await connectWithRetry(
    {
      model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
      messages,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 800,
      // seed باعث می‌شه ورودیِ یکسان خروجیِ پایدار بده (مثلاً تخمینِ کالریِ یک عکس هر بار یکی باشه).
      ...(opts.seed != null ? { seed: opts.seed } : {}),
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    },
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );

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
 * چون داده مداوم روی connection جاری است، reverse-proxy ایران
 * idle timeout نمی‌زند — 502/504 چت حل می‌شود.
 */
export async function* streamText(
  messages: AIMessage[],
  opts?: { temperature?: number; maxTokens?: number; timeoutMs?: number }
): AsyncGenerator<string> {
  const res = await connectWithRetry(
    {
      model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
      messages,
      temperature: opts?.temperature ?? 0.7,
      max_tokens: opts?.maxTokens ?? 400,
      stream: true,
    },
    opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );

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
