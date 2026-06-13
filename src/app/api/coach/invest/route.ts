import { authed, ok, bad } from "@/lib/api";
import { guardAI } from "@/lib/aiGuard";
import { aiText, type AIMessage } from "@/lib/openrouter";
import { getMarketRates } from "@/lib/market";
import { monthKey, monthStart } from "@/lib/format";

export const runtime = "nodejs";

const DENOM_FA: Record<string, string> = {
  toman: "تومان",
  usd: "دلار",
  gold: "گرم طلای ۱۸",
  coin: "سکه‌ی امامی",
};

function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export async function POST(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const guard = await guardAI(a.db, a.uid, "coach_invest");
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

  const mk = monthKey();
  const [txRes, goalRes, profileRes, rates] = await Promise.all([
    a.db.from("transactions").select("kind, amount, category, occurred_on").eq("user_id", a.uid).gte("occurred_on", monthStart(mk)),
    a.db.from("purchase_goals").select("title, denom, target_native, saved_toman, target_date, status").eq("user_id", a.uid).eq("status", "active"),
    a.db.from("profiles").select("currency, monthly_budget").eq("user_id", a.uid).maybeSingle(),
    getMarketRates(),
  ]);

  const txs = (txRes.data || []).filter((t) => String(t.occurred_on).startsWith(mk));
  let income = 0, expense = 0;
  const byCat: Record<string, number> = {};
  for (const t of txs) {
    if (t.kind === "income") income += Number(t.amount);
    else {
      expense += Number(t.amount);
      byCat[t.category] = (byCat[t.category] || 0) + Number(t.amount);
    }
  }
  const surplus = income - expense;
  const topCats = Object.entries(byCat).sort((x, y) => y[1] - x[1]).slice(0, 4);
  const currency = profileRes.data?.currency || "تومان";

  const ratesLine = rates.usd || rates.gold || rates.coin
    ? `نرخِ امروزِ بازارِ آزاد (تومان) — ${rates.usd ? `دلار: ${fmt(rates.usd)}؛ ` : ""}${rates.gold ? `هر گرم طلای ۱۸: ${fmt(rates.gold)}؛ ` : ""}${rates.coin ? `سکه‌ی امامی: ${fmt(rates.coin)}` : ""}`
    : "نرخِ زنده‌ی بازار الان در دسترس نیست.";

  const goalsLine = (goalRes.data || []).length
    ? "هدف‌های خریدِ فعالِ کاربر:\n" +
      goalRes.data!
        .map((g) => {
          const unit = DENOM_FA[g.denom] || "تومان";
          const tomanTarget =
            g.denom === "usd" && rates.usd ? Number(g.target_native) * rates.usd
            : g.denom === "gold" && rates.gold ? Number(g.target_native) * rates.gold
            : g.denom === "coin" && rates.coin ? Number(g.target_native) * rates.coin
            : g.denom === "toman" ? Number(g.target_native)
            : null;
          const pct = tomanTarget ? Math.round((Number(g.saved_toman) / tomanTarget) * 100) : null;
          return `• «${g.title}» — هدف: ${fmt(Number(g.target_native))} ${unit}${tomanTarget ? ` (حدود ${fmt(tomanTarget)} تومان)` : ""}؛ پس‌اندازِ تا حالا: ${fmt(Number(g.saved_toman))} تومان${pct != null ? ` (${pct}٪)` : ""}${g.target_date ? `؛ تاریخِ هدف: ${g.target_date}` : ""}`;
        })
        .join("\n")
    : "هنوز هیچ هدفِ خریدی نگذاشته.";

  const snapshot =
    `وضعیتِ مالیِ این ماهِ کاربر (واحد: ${currency}):\n` +
    `• درآمدِ ثبت‌شده: ${fmt(income)}\n` +
    `• هزینه‌ی ثبت‌شده: ${fmt(expense)}\n` +
    `• مازاد (سرمایه‌ی قابلِ سرمایه‌گذاری): ${fmt(surplus)}\n` +
    (topCats.length ? `• بزرگ‌ترین دسته‌های خرج: ${topCats.map(([c, v]) => `${c} ${fmt(v)}`).join("، ")}\n` : "") +
    `\n${ratesLine}\n\n${goalsLine}`;

  try {
    const reply = await aiText(
      [
        {
          role: "system",
          content:
            "تو «همراهِ آموزشِ مالیِ» کاربر در یک اپِ فارسی هستی و فقط فارسیِ گرم و ساده حرف می‌زنی. " +
            "تو مشاورِ سرمایه‌گذاریِ دارای مجوز نیستی و نقشت صرفاً «آموزشی» است، نه ارائه‌ی مشاوره‌ی مالیِ شخصی‌سازی‌شده. " +
            "نقشِ تو دو چیز است: (۱) کمک به کاربر برای گذاشتن و رسیدن به «هدفِ خرید»، و (۲) تحلیلِ وضعیتِ مالیِ کاربر و آموزشِ مفاهیم تا خودش بهتر تصمیم بگیرد. " +
            "هدفِ بزرگ‌ترت این است که کاربر «یاد بگیرد سرمایه‌گذاری کند» و یاد بگیرد به‌جای تومان، به دارایی فکر کند. " +
            "زمینه را همیشه ایرانی نگه دار: تورمِ بالا و بی‌ثبات، نوسانِ شدیدِ دلار، اثرِ تنش/جنگ و تحریم روی بازار، و این‌که نگه‌داشتنِ پولِ نقدِ تومانی یعنی از دست دادنِ ارزش. " +
            "وقتی از سرمایه‌گذاری حرف می‌زنی، گزینه‌های واقعیِ ایران را به‌صورتِ آموزشی و بی‌طرف معرفی و سبک‌سنگین کن: طلا و سکه، دلار، صندوق‌های سرمایه‌گذاری (طلا/درآمد ثابت/سهامی)، بورس، مسکن، و رمزارز — با ریسک و نقدشوندگیِ هرکدام. " +
            "قانونِ قطعی و غیرقابلِ‌نقض: هرگز به کاربر دستور یا توصیه‌ی مشخصِ خرید/فروش نده. هیچ‌وقت نگو «برو طلا بخر»، «دلار بخر»، «این سهم را بخر/بفروش» یا «الان وقتِ خریدِ X است». به‌جایش گزینه‌ها و سازوکارشان را توضیح بده و انتخاب را به خودِ کاربر بسپار. اگر کاربر مستقیم پرسید «چی بخرم؟»، توضیح بده که نمی‌توانی توصیه‌ی شخصی بدهی، گزینه‌ها و معیارهای تصمیم را آموزش بده و او را به مشورت با مشاورِ دارای مجوز ارجاع بده. " +
            "همیشه «آموزش» بده، نه توصیه‌ی قطعیِ «این را بخر / آن را بفروش». تأکید کن تصمیمِ نهایی با خودِ کاربر است و گذشته تضمینِ آینده نیست. " +
            "خیلی مهم: کاربر را برای خرج‌کردن سرزنش نکن و عادتِ ریزه‌کاری نساز (مثلِ «از قهوه‌ات بزن») — به‌جایش روی تصویرِ بزرگ، حفظِ ارزشِ پول و رساندنِ مازاد به یک دارایی تمرکز کن. " +
            "از دادهٔ واقعیِ کاربر استفاده کن: وقتی مرتبط است هدفش را برحسبِ دلار/طلا بیان کن و نشان بده تورم چطور هدف را جابه‌جا می‌کند. " +
            "کوتاه، مشخص و عملی جواب بده (معمولاً ۳ تا ۵ جمله). بدون Markdownِ سنگین.\n\n" +
            snapshot,
        },
        ...history,
      ],
      { temperature: 0.6, maxTokens: 450, tag: "coach_invest" }
    );
    return ok({ reply: reply.trim() });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "مشاور الان نتونست جواب بده.", 502);
  }
}
