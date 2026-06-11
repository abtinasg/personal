import { authed, ok, bad } from "@/lib/api";
import { guardAI } from "@/lib/aiGuard";
import { aiJSON } from "@/lib/openrouter";
import { todayISO, daysAgoISO } from "@/lib/format";
import { getCached, setCached, secondsUntilMidnight } from "@/lib/aiCache";

export const runtime = "nodejs";

export type WeeklyReview = {
  headline: string;
  narrative: string;
  wins: string[];
  focus: string;
  suggestion: string;
};

type WeeklyStats = {
  habitRate: number; // 0..100
  habitDone: number;
  habitPossible: number;
  bestStreakIdentity: string | null;
  votesThisWeek: number;
  calAvg: number;
  calGoal: number;
  calDaysLogged: number;
  expenseTotal: number;
  topCategory: { name: string; amount: number } | null;
  moodAvg: number | null;
  moodDays: number;
  activeMission: string | null;
};

export async function GET(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;

  // quick=1: آمارها را بدون فراخوانیِ AI برمی‌گرداند — کلاینت آن‌ها را فوری نشان می‌دهد
  // و بعد یک درخواستِ جداگانه برای تحلیلِ AI می‌فرستد.
  const quick = new URL(req.url).searchParams.get("quick") === "1";

  const today = todayISO();
  const cacheKey = `weekly:${a.uid}:${today}`;
  const cached = await getCached<object>(a.db, cacheKey);
  if (cached) return ok(cached);

  if (!quick) {
    const guard = await guardAI(a.db, a.uid, "coach_weekly");
    if ("error" in guard) return guard.error;
  }
  const weekAgo = daysAgoISO(6);

  const [habitRes, logRes, idnRes, mealRes, txRes, moodRes, missionRes, profileRes] = await Promise.all([
    a.db.from("habits").select("id, name, identity_id").eq("user_id", a.uid).eq("archived", false),
    a.db.from("habit_logs").select("habit_id, done_on").eq("user_id", a.uid).gte("done_on", weekAgo),
    a.db.from("identities").select("id, name").eq("user_id", a.uid).eq("archived", false),
    a.db.from("meals").select("calories, eaten_on").eq("user_id", a.uid).gte("eaten_on", weekAgo),
    a.db.from("transactions").select("amount, category, kind, occurred_on").eq("user_id", a.uid).gte("occurred_on", weekAgo),
    a.db.from("moods").select("score, recorded_on").eq("user_id", a.uid).gte("recorded_on", weekAgo),
    a.db.from("missions").select("title").eq("user_id", a.uid).eq("status", "active").order("created_at", { ascending: false }).limit(1),
    a.db.from("profiles").select("daily_calorie_goal").eq("user_id", a.uid).maybeSingle(),
  ]);

  const habits = habitRes.data || [];
  const logs = logRes.data || [];
  const identities = idnRes.data || [];
  const meals = mealRes.data || [];
  const txs = txRes.data || [];
  const moods = moodRes.data || [];

  const hasData = habits.length > 0 || meals.length > 0 || txs.length > 0 || moods.length > 0;
  if (!hasData) {
    const payload = { hasData: false };
    if (!quick) await setCached(a.db, cacheKey, payload, secondsUntilMidnight());
    return ok(payload);
  }

  // عادت‌ها: نرخِ انجام در ۷ روز — فقط روزهایی که عادت از قبل وجود داشته حساب می‌شه
  const weekAgoMs = new Date(weekAgo).getTime();
  const todayMs = new Date(today).getTime();
  const habitPossible = habits.reduce((sum, h) => {
    const createdMs = new Date((h.created_at as string).slice(0, 10)).getTime();
    const startMs = Math.max(createdMs, weekAgoMs);
    const days = Math.floor((todayMs - startMs) / 86400000) + 1;
    return sum + Math.max(0, Math.min(7, days));
  }, 0);
  const habitDone = logs.length;
  const habitRate = habitPossible ? Math.round((habitDone / habitPossible) * 100) : 0;

  // رأی‌های هر هویت این هفته
  const habitIdentity = new Map<string, string | null>(habits.map((h) => [h.id, h.identity_id]));
  const idnName = new Map<string, string>(identities.map((i) => [i.id, i.name as string]));
  const voteByIdn = new Map<string, number>();
  for (const l of logs) {
    const idn = habitIdentity.get(l.habit_id);
    if (idn) voteByIdn.set(idn, (voteByIdn.get(idn) || 0) + 1);
  }
  let bestStreakIdentity: string | null = null;
  let bestVotes = 0;
  for (const [idn, v] of voteByIdn) {
    if (v > bestVotes) { bestVotes = v; bestStreakIdentity = idnName.get(idn) || null; }
  }

  // کالری
  const calByDay = new Map<string, number>();
  for (const m of meals) calByDay.set(m.eaten_on, (calByDay.get(m.eaten_on) || 0) + (Number(m.calories) || 0));
  const calDaysLogged = calByDay.size;
  const calTotal = [...calByDay.values()].reduce((s, v) => s + v, 0);
  const calAvg = calDaysLogged ? Math.round(calTotal / calDaysLogged) : 0;
  const calGoal = profileRes.data?.daily_calorie_goal || 2000;

  // خرج
  let expenseTotal = 0;
  const byCat = new Map<string, number>();
  for (const t of txs) {
    if (t.kind === "expense") {
      const amt = Number(t.amount) || 0;
      expenseTotal += amt;
      const c = String(t.category || "سایر");
      byCat.set(c, (byCat.get(c) || 0) + amt);
    }
  }
  let topCategory: WeeklyStats["topCategory"] = null;
  let topAmt = 0;
  for (const [name, amount] of byCat) {
    if (amount > topAmt) { topAmt = amount; topCategory = { name, amount }; }
  }

  // حال‌وهوا
  const moodDays = moods.length;
  const moodAvg = moodDays ? Math.round((moods.reduce((s, m) => s + (Number(m.score) || 0), 0) / moodDays) * 10) / 10 : null;

  const activeMission = (missionRes.data?.[0]?.title as string) || null;

  const stats: WeeklyStats = {
    habitRate, habitDone, habitPossible,
    bestStreakIdentity, votesThisWeek: habitDone,
    calAvg, calGoal, calDaysLogged,
    expenseTotal, topCategory,
    moodAvg, moodDays,
    activeMission,
  };

  // quick mode: آمار را فوری برمی‌گردانیم — کلاینت بعداً برای review درخواست می‌فرستد
  if (quick) return ok({ hasData: true, stats });

  const MOOD_FA = ["", "بد", "نه‌چندان", "معمولی", "خوب", "عالی"];
  const factLines = [
    `بازه: ۷ روزِ گذشته تا ${today}`,
    `عادت‌ها: ${habitDone} رأی از ${habitPossible} ممکن (${habitRate}٪ انجام)`,
    bestStreakIdentity ? `پُرتلاش‌ترین هویت این هفته: «${bestStreakIdentity}» با ${bestVotes} رأی` : "",
    calDaysLogged ? `کالری: میانگین ${calAvg} در روز (هدف ${calGoal})، ${calDaysLogged} روز ثبت شده` : "کالری: چیزی ثبت نشده",
    expenseTotal ? `خرج: مجموع ${expenseTotal} تومان` + (topCategory ? `، بیشترین در «${topCategory.name}» (${topCategory.amount})` : "") : "خرج: ثبت نشده",
    moodAvg != null ? `حال‌وهوا: میانگین ${moodAvg} از ۵ (${MOOD_FA[Math.round(moodAvg)] || ""})، ${moodDays} روز` : "حال‌وهوا: ثبت نشده",
    activeMission ? `ماموریت فعال: «${activeMission}»` : "",
  ].filter(Boolean).join("\n");

  try {
    const review = await aiJSON<WeeklyReview>(
      [
        {
          role: "system",
          content:
            "تو یک مربیِ گرم و هویت‌محور بر پایه‌ی «عادت‌های اتمی» جیمز کلیر هستی و فقط فارسی حرف می‌زنی. " +
            "بر اساس آمارِ هفتگیِ واقعیِ کاربر یک «مرورِ هفتگیِ هوشمند» بنویس. سرزنش نکن؛ صادق ولی مهربون باش؛ روی هویت و ثبات تمرکز کن نه کمال. " +
            "خروجی فقط JSON با این کلیدها: " +
            "headline (یک جمله‌ی کوتاهِ جمع‌بندیِ هفته)، " +
            "narrative (۲ تا ۳ جمله که الگوها و معنیِ اعداد رو با لحنِ انسانی توضیح می‌ده)، " +
            "wins (آرایه‌ی ۱ تا ۳ موردِ کوتاه از چیزهایی که خوب پیش رفته)، " +
            "focus (یک جمله: مهم‌ترین چیزی که هفته‌ی بعد روش تمرکز کنه)، " +
            "suggestion (یک پیشنهادِ عملیِ کوچک و مشخص بر اساس قانونِ ۲ دقیقه یا «هیچ‌وقت دوبار جا ننداز»). " +
            "بدون Markdown. اعداد رو توی متن طبیعی بیار.",
        },
        { role: "user", content: factLines },
      ],
      { temperature: 0.6, maxTokens: 380 }
    );

    const payload = {
      hasData: true,
      stats,
      review: {
        headline: String(review.headline || "").trim(),
        narrative: String(review.narrative || "").trim(),
        wins: Array.isArray(review.wins) ? review.wins.map((w) => String(w).trim()).filter(Boolean).slice(0, 3) : [],
        focus: String(review.focus || "").trim(),
        suggestion: String(review.suggestion || "").trim(),
      },
    };
    await setCached(a.db, cacheKey, payload, secondsUntilMidnight());
    return ok(payload);
  } catch (e) {
    return bad(e instanceof Error ? e.message : "تهیه‌ی مرورِ هفتگی با خطا روبه‌رو شد.", 502);
  }
}
