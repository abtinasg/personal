import type { MarketRates } from "@/lib/types";

/**
 * نرخِ بازارِ ایران (به تومان). چون دسترسی ناپایدار است، چند منبع را
 * زنجیره‌وار امتحان می‌کنیم و نتیجه را کش می‌کنیم:
 *   ۱) tgju — بازارِ آزادِ ایران، کامل (دلار، طلا، سکه، بیت‌کوین). میزبانِ ایرانی.
 *   ۲) منابعِ بین‌المللی — دلار از er-api، طلای ۱۸ از gold-api، بیت‌کوین از CoinGecko.
 *      (سکه را اینجا خالی می‌گذاریم چون حبابِ بازارِ ایران بین‌المللی قابلِ‌محاسبه نیست.)
 * در صورتِ شکستِ همه، آخرین نرخِ موفق برمی‌گردد؛ اگر هیچ‌وقت موفق نشده باشیم null.
 */

// جدولِ خلاصه‌ی هر نماد در tgju؛ این میزبان از سرورِ ابری قابلِ‌دسترس است
// (برخلافِ call.tgju.org که اغلب از بیرونِ ایران resolve نمی‌شود).
const TGJU_BASE = "https://api.tgju.org/v1/market/indicator/summary-table-data";
const COINGECKO = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd";
const GOLD_API = "https://api.gold-api.com/price/XAU"; // دلار به ازای هر اونسِ طلای خالص
const FOREX_API = "https://open.er-api.com/v6/latest/USD"; // نرخِ بازارِ دلار (IRR)

const OZ_TO_G = 31.1035; // اونسِ تروی به گرم
const PURITY_18 = 0.75; // عیارِ ۱۸ از ۲۴
const TTL_MS = 15 * 60 * 1000;

type CacheEntry = { rates: MarketRates; at: number };
let cache: CacheEntry | null = null;
let lastGood: MarketRates | null = null;

/** رشته‌ی عددی («۵۹۸,۵۰۰» یا "598,500") را به Number تبدیل می‌کند. */
function num(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v)
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[^\d.]/g, "");
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function getJSON(url: string, timeoutMs = 6000): Promise<any> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

/**
 * آخرین قیمتِ «پایانیِ» یک نماد از جدولِ خلاصه‌ی tgju.
 * هر سطر: [بازگشایی، کمترین، بیشترین، پایانی، تغییر، درصد، تاریخِ میلادی، تاریخِ شمسی].
 * قیمتِ ارز/طلا/سکه به ریال است؛ بیت‌کوین به دلار.
 */
async function tgjuClose(symbol: string): Promise<number | null> {
  try {
    const data = await getJSON(`${TGJU_BASE}/${symbol}`);
    const row = Array.isArray(data?.data) ? data.data[0] : null;
    return num(row?.[3]);
  } catch {
    return null;
  }
}

/** منبعِ اولِ ایرانی (کامل) — نرخِ بازارِ آزاد. */
async function fromTgju(): Promise<MarketRates | null> {
  const [dollarRl, gold18Rl, coinRl, btcUsd] = await Promise.all([
    tgjuClose("price_dollar_rl"),
    tgjuClose("geram18"),
    tgjuClose("sekee"),
    tgjuClose("crypto-bitcoin"),
  ]);
  // ریال به تومان
  const usd = dollarRl != null ? Math.round(dollarRl / 10) : null;
  const gold = gold18Rl != null ? Math.round(gold18Rl / 10) : null;
  const coin = coinRl != null ? Math.round(coinRl / 10) : null;
  const btc = btcUsd != null && usd != null ? Math.round(btcUsd * usd) : null;
  if (!usd && !gold && !coin) return null;
  return { usd, gold, coin, btc, updated_at: new Date().toISOString(), source: "live" };
}

/** fallbackِ بین‌المللی — دلار/طلا/بیت‌کوین را از منابعِ جهانی می‌سازد. */
async function fromGlobal(): Promise<MarketRates | null> {
  try {
    const [forex, gold, crypto] = await Promise.allSettled([
      getJSON(FOREX_API),
      getJSON(GOLD_API),
      getJSON(COINGECKO),
    ]);

    const irr = forex.status === "fulfilled" ? num(forex.value?.rates?.IRR) : null;
    const usd = irr != null ? Math.round(irr / 10) : null; // ریال به تومان

    const xauUsd = gold.status === "fulfilled" ? num(gold.value?.price) : null; // دلار/اونسِ ۲۴
    const gold18 = xauUsd != null && usd != null
      ? Math.round((xauUsd / OZ_TO_G) * PURITY_18 * usd) // تومان به ازای هر گرمِ ۱۸
      : null;

    const btcUsd = crypto.status === "fulfilled" ? num(crypto.value?.bitcoin?.usd) : null;
    const btc = btcUsd != null && usd != null ? Math.round(btcUsd * usd) : null;

    if (!usd && !gold18 && !btc) return null;
    return { usd, gold: gold18, coin: null, btc, updated_at: new Date().toISOString(), source: "global" };
  } catch {
    return null;
  }
}

export async function getMarketRates(): Promise<MarketRates> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rates;

  const rates = (await fromTgju()) || (await fromGlobal());
  if (rates) {
    lastGood = rates;
    cache = { rates, at: Date.now() };
    return rates;
  }

  if (lastGood) return { ...lastGood, source: "fallback" };
  return { usd: null, gold: null, coin: null, btc: null, updated_at: null, source: "unavailable" };
}
