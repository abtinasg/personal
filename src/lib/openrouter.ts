import { logError, logWarn, errDetail } from "@/lib/log";

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
    /** نامِ فیچرِ صدازننده (coach_chat، meal_estimate، …) — برای فیلترکردنِ لاگ. */
    tag?: string;
  } = {}
): Promise<string> {
  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const model = opts.model ?? (process.env.OPENROUTER_MODEL || DEFAULT_MODEL);
  const started = performance.now();
  // زمینه‌ی مشترکِ همه‌ی لاگ‌های این فراخوانی — بدونش نمی‌شود فهمید کدام
  // فیچر/مدل مشکل دارد.
  const ctx = () => ({ model, tag: opts.tag, latencyMs: Math.round(performance.now() - started) });

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
        model,
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
      void logError("ai", "timeout", { detail: { ...ctx(), timeoutMs } });
      throw new Error("هوش مصنوعی به‌موقع پاسخ نداد. لطفاً دوباره تلاش کن.");
    }
    // خطای شبکه (DNS/فیلترینگ/قطعی) — شایع‌ترین دلیلِ «AI کار نمی‌کند» روی سرورِ ایران.
    void logError("ai", "network_error", { detail: { ...ctx(), ...errDetail(e) } });
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    void logError("ai", "provider_error", {
      detail: { ...ctx(), status: res.status, body: detail.slice(0, 300) },
    });
    throw new Error("سرویسِ هوش مصنوعی الان در دسترس نیست. لطفاً دوباره تلاش کن.");
  }

  const data = await res.json().catch(() => null);
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    void logError("ai", "invalid_response", { detail: ctx() });
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
      // اصلی کُند است — fallback موازی استارت می‌خورَد. اگر این زیاد تکرار شود
      // یعنی مدل/مسیرِ اصلی مشکل دارد.
      void logWarn("ai", "fallback_slow_primary", {
        detail: { tag: opts?.tag, fallback: FALLBACK_MODEL, afterMs: FALLBACK_DELAY_MS },
      });
      call(messages, { ...opts, model: FALLBACK_MODEL }).then(win).catch(lose);
    }, FALLBACK_DELAY_MS);

    call(messages, opts)
      .then((v) => { clearTimeout(timer); win(v); })
      .catch((e) => {
        // اصلی شکست خورد — فوری fallback را استارت می‌زنیم (اگر هنوز شروع نشده)
        clearTimeout(timer);
        if (settled) return;
        void logWarn("ai", "fallback_after_error", {
          detail: { tag: opts?.tag, fallback: FALLBACK_MODEL, ...errDetail(e) },
        });
        call(messages, { ...opts, model: FALLBACK_MODEL }).then(win).catch(lose);
      });
  });
}

/** یک پاسخ متنی آزاد از مدل می‌گیرد. */
export async function aiText(
  messages: AIMessage[],
  opts?: { temperature?: number; maxTokens?: number; seed?: number; timeoutMs?: number; tag?: string }
): Promise<string> {
  return raceWithFallback(messages, opts);
}

/** از مدل می‌خواهد فقط JSON بدهد و آن را parse می‌کند. */
export async function aiJSON<T>(
  messages: AIMessage[],
  opts?: { temperature?: number; maxTokens?: number; seed?: number; timeoutMs?: number; tag?: string }
): Promise<T> {
  const raw = await raceWithFallback(messages, { ...opts, json: true });
  try {
    return parseJSON<T>(raw);
  } catch (e) {
    // مدل JSON قول داده بود ولی چیزِ دیگری داد — برای دیباگ، ابتدای خروجی را نگه می‌داریم.
    void logError("ai", "json_parse_failed", {
      detail: { tag: opts?.tag, snippet: raw.slice(0, 200) },
    });
    throw e;
  }
}

/**
 * توکن‌های متنی را از OpenRouter یکی‌یکی yield می‌کند.
 * چون داده مداوم روی connection جاری است، reverse-proxy ایران
 * idle timeout نمی‌زند — 502/504 چت حل می‌شود.
 */
export async function* streamText(
  messages: AIMessage[],
  opts?: { temperature?: number; maxTokens?: number; timeoutMs?: number; tag?: string }
): AsyncGenerator<string> {
  const controller = new AbortController();
  // timeout فقط تا دریافتِ اولین بایت از سرور — بعد از آن connection زنده است
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  const started = performance.now();
  const ctx = () => ({
    model,
    tag: opts?.tag,
    stream: true,
    latencyMs: Math.round(performance.now() - started),
  });

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
        model,
        messages,
        temperature: opts?.temperature ?? 0.7,
        max_tokens: opts?.maxTokens ?? 400,
        stream: true,
      }),
      signal: controller.signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      void logError("ai", "timeout", { detail: { ...ctx(), timeoutMs } });
      throw new Error("هوش مصنوعی به‌موقع پاسخ نداد. لطفاً دوباره تلاش کن.");
    }
    void logError("ai", "network_error", { detail: { ...ctx(), ...errDetail(e) } });
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    void logError("ai", "provider_error", {
      detail: { ...ctx(), status: res.status, body: detail.slice(0, 300) },
    });
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
