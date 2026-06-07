"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/client";
import { fa, money, todayISO, daysAgoISO, monthStart, monthKey, jWeekday, isoDay } from "@/lib/format";
import { type Habit, type HabitLog, type HealthMetric, type Identity, type Meal, type Mission, type Mood, type Profile, type Tab, type Transaction, identityLevel } from "@/lib/types";
import { Card, SectionTitle, Spinner, StatTile } from "@/components/ui";
import { AppIcon } from "@/components/AppIcon";

const MOODS = [
  { score: 1, emoji: "😞", label: "بد" },
  { score: 2, emoji: "😕", label: "نه‌چندان" },
  { score: 3, emoji: "😐", label: "معمولی" },
  { score: 4, emoji: "🙂", label: "خوب" },
  { score: 5, emoji: "😄", label: "عالی" },
];

function daysLeft(end_on: string | null): number | null {
  if (!end_on) return null;
  const end = new Date(end_on + "T00:00:00").getTime();
  const now = new Date(todayISO() + "T00:00:00").getTime();
  return Math.max(0, Math.round((end - now) / 86400000));
}

export default function DashboardView({ profile, onGoto }: { profile: Profile | null; onGoto: (t: Tab) => void }) {
  const [data, setData] = useState<{
    meals: Meal[]; txs: Transaction[]; metrics: HealthMetric[];
    habits: Habit[]; logs: HabitLog[]; moods: Mood[];
    missions: Mission[]; identities: Identity[];
  } | null>(null);
  const today = todayISO();
  const mk = monthKey();

  const load = useCallback(async () => {
    const [m, t, h, hb, md, ms, idn] = await Promise.all([
      apiGet<{ meals: Meal[] }>(`/api/meals?date=${today}`),
      apiGet<{ transactions: Transaction[] }>(`/api/transactions?from=${monthStart(mk)}`),
      apiGet<{ metrics: HealthMetric[] }>(`/api/health?from=${today}`),
      apiGet<{ habits: Habit[]; logs: HabitLog[] }>(`/api/habits?from=${today}`),
      apiGet<{ moods: Mood[] }>(`/api/moods?from=${daysAgoISO(6)}`),
      apiGet<{ missions: Mission[] }>("/api/missions"),
      apiGet<{ identities: Identity[] }>("/api/identities"),
    ]);
    setData({
      meals: m.meals, txs: t.transactions, metrics: h.metrics,
      habits: hb.habits, logs: hb.logs, moods: md.moods,
      missions: ms.missions, identities: idn.identities,
    });
  }, [today, mk]);

  useEffect(() => { load(); }, [load]);

  async function setMood(score: number) {
    setData((d) => d && { ...d, moods: upsertMood(d.moods, today, score) });
    await apiSend("/api/moods", "POST", { score, date: today });
  }

  if (!data) return <div className="pt-20 flex justify-center"><Spinner /></div>;

  const calGoal = profile?.daily_calorie_goal || 2000;
  const consumed = data.meals.reduce((s, m) => s + m.calories, 0);

  const monthExpense = data.txs.filter((t) => t.kind === "expense" && t.occurred_on.startsWith(mk)).reduce((s, t) => s + Number(t.amount), 0);
  const monthIncome = data.txs.filter((t) => t.kind === "income" && t.occurred_on.startsWith(mk)).reduce((s, t) => s + Number(t.amount), 0);
  const budget = profile?.monthly_budget || 0;

  const waterGoal = profile?.water_goal_ml || 2000;
  const waterToday = data.metrics.filter((m) => m.kind === "water").reduce((s, m) => s + Number(m.value), 0);

  const doneToday = new Set(data.logs.filter((l) => isoDay(l.done_on) === today).map((l) => l.habit_id));
  const habitsDone = data.habits.filter((h) => doneToday.has(h.id)).length;

  const todayMood = data.moods.find((m) => isoDay(m.recorded_on) === today);
  const currency = profile?.currency || "تومان";

  const activeMission = data.missions.find((m) => m.status === "active");
  const topIdentities = [...data.identities].sort((a, b) => b.vote_total - a.vote_total).slice(0, 4);

  return (
    <div className="space-y-3">
      {/* ماموریت فعال */}
      {activeMission ? (() => {
        const m = activeMission;
        const reached = m.milestones.filter((x) => x.reached_at).length;
        const total = m.milestones.length;
        const dleft = daysLeft(m.end_on);
        const linked = m.habit_ids;
        const linkedDone = linked.filter((id) => doneToday.has(id)).length;
        return (
          <Card onClick={() => onGoto("missions")} className="!p-0 overflow-hidden mt-2">
            <div className="p-5 text-white" style={{ backgroundImage: `linear-gradient(135deg, ${m.color}, ${m.color}cc)` }}>
              <div className="flex items-center gap-1.5 text-white/85 text-[12px] font-semibold mb-1">
                <span>ماموریت فعال</span>
                {dleft != null && <span>· {fa(dleft)} روز مانده</span>}
              </div>
              <div className="flex items-center gap-3">
                <span className="shrink-0"><AppIcon name={m.emoji} size={32} /></span>
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-[20px] leading-tight">{m.title}</p>
                  {m.why && <p className="text-white/85 text-[13px] mt-0.5 line-clamp-2">{m.why}</p>}
                </div>
              </div>
              <div className="flex items-center gap-4 mt-4 text-[13px]">
                {total > 0 && <span className="bg-white/20 rounded-full px-3 py-1 font-semibold inline-flex items-center gap-1.5"><AppIcon name="flag" size={14} /> {fa(reached)}/{fa(total)} نقطه‌عطف</span>}
                {linked.length > 0 && <span className="bg-white/20 rounded-full px-3 py-1 font-semibold inline-flex items-center gap-1.5"><AppIcon name="repeat" size={14} /> امروز {fa(linkedDone)}/{fa(linked.length)}</span>}
              </div>
            </div>
          </Card>
        );
      })() : (
        <Card onClick={() => onGoto("missions")} className="flex items-center gap-3 mt-2">
          <span className="text-ios-indigo shrink-0"><AppIcon name="rocket" size={28} /></span>
          <div className="flex-1">
            <p className="font-bold text-[16px]">یه ماموریت برای خودت بساز</p>
            <p className="secondary text-[13px]">هدفت رو به یک مسیر جذاب و روزانه تبدیل کن</p>
          </div>
          <span className="text-ios-blue text-[15px] font-semibold">شروع</span>
        </Card>
      )}

      {/* هویت‌ها */}
      {topIdentities.length > 0 && (
        <>
          <SectionTitle action={<button onClick={() => onGoto("identities")} className="text-ios-blue text-[15px] font-medium">همه</button>}>
            داری خودت رو می‌سازی
          </SectionTitle>
          <div className="flex gap-3 overflow-x-auto -mx-5 px-5 pb-1">
            {topIdentities.map((it) => {
              const lv = identityLevel(it.vote_total);
              return (
                <button key={it.id} onClick={() => onGoto("identities")} className="card !p-4 w-[150px] shrink-0 text-right active:scale-[0.98] transition">
                  <div className="flex items-center justify-between">
                    <span style={{ color: it.color }}><AppIcon name={it.emoji} size={24} /></span>
                    <span className="chip !py-0.5 !px-2 text-[11px]" style={{ background: it.color + "22", color: it.color }}>سطح {fa(lv.level)}</span>
                  </div>
                  <p className="font-bold text-[15px] mt-2 truncate">{it.name}</p>
                  <p className="secondary text-[12px] mt-0.5">{fa(it.vote_total)} رأی</p>
                  <div className="track mt-2 !h-2">
                    <div className="h-full rounded-full" style={{ width: `${lv.progress * 100}%`, background: it.color }} />
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* حال‌وهوا */}
      <SectionTitle>حالت چطوره؟</SectionTitle>
      <Card>
        <div className="flex justify-between gap-1">
          {MOODS.map((m) => {
            const active = todayMood?.score === m.score;
            return (
              <button
                key={m.score}
                onClick={() => setMood(m.score)}
                className={`flex flex-col items-center gap-1 flex-1 py-2 rounded-2xl transition ${active ? "bg-ios-yellow/20 scale-105" : "active:scale-95"}`}
              >
                <span className={`text-[34px] transition ${active ? "" : "grayscale opacity-60"}`}>{m.emoji}</span>
                <span className={`text-[11px] ${active ? "font-bold text-ios-orange" : "secondary"}`}>{m.label}</span>
              </button>
            );
          })}
        </div>
        {data.moods.length > 1 && (() => {
          const week = last7Moods(data.moods);
          const scored = data.moods.filter((m) => week.some((w) => w.date === isoDay(m.recorded_on)));
          const avg = scored.length ? scored.reduce((s, m) => s + m.score, 0) / scored.length : 0;
          const pct = Math.round((avg / 5) * 100);
          const label = pct >= 70 ? "هفته‌ی خوبیه" : pct >= 45 ? "هفته‌ی معمولیه" : "هفته‌ی سختیه";
          return (
            <div className="mt-4 pt-3 border-t border-[var(--sep)]">
              <p className="font-bold text-[15px] mb-1">سفرِ حالت این هفته</p>
              <p className="secondary text-[12px] mb-4">ببین احساساتت چطور تغییر کرد</p>
              <div className="flex items-center gap-5">
                <div className="relative shrink-0" style={{ width: 96, height: 88 }}>
                  <svg viewBox="0 0 100 92" width="96" height="88">
                    <defs>
                      <linearGradient id="heartGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#efc25e" />
                        <stop offset="100%" stopColor="#ef9d63" />
                      </linearGradient>
                      <clipPath id="heartClip">
                        <path d="M50 85 C50 85 5 55 5 28 C5 14 16 5 28 5 C36 5 44 9 50 16 C56 9 64 5 72 5 C84 5 95 14 95 28 C95 55 50 85 50 85Z" />
                      </clipPath>
                    </defs>
                    {/* background heart */}
                    <path d="M50 85 C50 85 5 55 5 28 C5 14 16 5 28 5 C36 5 44 9 50 16 C56 9 64 5 72 5 C84 5 95 14 95 28 C95 55 50 85 50 85Z" fill="rgba(245,180,122,0.18)" />
                    {/* filled heart from bottom */}
                    <rect x="0" y={92 - (92 * pct) / 100} width="100" height="92" clipPath="url(#heartClip)" fill="url(#heartGrad)" />
                    <text x="50" y="48" textAnchor="middle" fontSize="20" fontWeight="800" fill="white" style={{ fontFamily: "var(--font-vazir)" }}>{pct}٪</text>
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-extrabold text-[18px] leading-snug">{label}</p>
                  <div className="flex justify-between mt-3">
                    {week.map((d) => (
                      <div key={d.date} className="flex flex-col items-center gap-0.5">
                        <span className={`text-lg ${d.emoji ? "" : "opacity-20"}`}>{d.emoji || "·"}</span>
                        <span className="secondary text-[10px]">{jWeekday(d.date)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </Card>

      {/* خلاصه */}
      <SectionTitle>یک نگاه به امروز</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <StatTile tint="var(--t-peach)" label="کالری" value={fa(consumed)} sub={`از ${fa(calGoal)}`}
          icon="flame" iconColor="var(--peach)" onClick={() => onGoto("calorie")} />
        <StatTile tint="var(--t-sage)" label="رأی امروز" value={`${fa(habitsDone)}/${fa(data.habits.length)}`} sub="عادت‌ها"
          ring={data.habits.length ? habitsDone / data.habits.length : 0} ringColor="var(--sage)"
          icon="vote" iconColor="var(--sage)" onClick={() => onGoto("habit")} />
        <StatTile tint="var(--t-blue)" label="آب" value={fa(waterToday)} sub={`از ${fa(waterGoal)}ml`}
          icon="water" iconColor="var(--blue)" onClick={() => onGoto("health")} />
        <StatTile tint="var(--t-lav)" label="سرمایه‌ی ماه" value={fa(monthIncome - monthExpense)} sub="مازاد قابلِ سرمایه‌گذاری"
          icon="wallet" iconColor="var(--lav)" onClick={() => onGoto("budget")} />
      </div>

      {budget > 0 && (
        <Card onClick={() => onGoto("budget")}>
          <div className="flex items-center justify-between mb-2">
            <p className="font-bold">بودجه‌ی این ماه</p>
            <p className={`font-bold ${budget - monthExpense < 0 ? "text-ios-red" : "text-ios-green"}`}>
              {money(budget - monthExpense, currency)} مانده
            </p>
          </div>
          <div className="h-3 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, (monthExpense / budget) * 100)}%`, background: monthExpense > budget ? "#f08197" : "#1f6ca6" }}
            />
          </div>
        </Card>
      )}
    </div>
  );
}

function upsertMood(moods: Mood[], date: string, score: number): Mood[] {
  const i = moods.findIndex((m) => isoDay(m.recorded_on) === date);
  if (i >= 0) {
    const copy = [...moods];
    copy[i] = { ...copy[i], score };
    return copy;
  }
  return [{ id: "tmp" + Math.random(), score, note: null, recorded_on: date }, ...moods];
}

function last7Moods(moods: Mood[]) {
  const byDate = new Map(moods.map((m) => [m.recorded_on, m.score]));
  const emojiOf = (s?: number) => (s ? MOODS.find((m) => m.score === s)?.emoji : undefined);
  return Array.from({ length: 7 }, (_, i) => {
    const date = daysAgoISO(6 - i);
    return { date, emoji: emojiOf(byDate.get(date)) };
  });
}
