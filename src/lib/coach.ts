import { getServiceClient } from "@/lib/supabase";
import { todayISO, daysAgoISO } from "@/lib/format";

type DB = ReturnType<typeof getServiceClient>;

export type UserSnapshot = {
  text: string;
  hasData: boolean;
  identities: { name: string; votes: number; week: number; level: number }[];
  activeMission: { title: string; daysLeft: number | null; milestonesDone: number; milestonesTotal: number } | null;
  habits: { total: number; doneToday: number; missedYesterday: string[] };
  streak: number;
};

function levelOf(votes: number): number {
  let level = 1, base = 0, step = 5;
  while (votes >= base + step) { base += step; level += 1; step += 5; }
  return level;
}

/**
 * استریکِ «روزهای پیاپیِ عالی» = روزهای پشت‌سرهمی که همه‌ی عادت‌های فعال انجام شده‌اند.
 * امروزِ ناتمام استریک را نمی‌شکند (از دیروز می‌شمارد). این منطق هم در مربی و هم در جایزه‌ها استفاده می‌شود.
 */
export function computeGoodStreak(
  activeHabitIds: string[],
  logs: { habit_id: string; done_on: string }[]
): { streak: number; startISO: string | null } {
  if (!activeHabitIds.length) return { streak: 0, startISO: null };
  const byDay = new Map<string, Set<string>>();
  for (const l of logs) {
    if (!byDay.has(l.done_on)) byDay.set(l.done_on, new Set());
    byDay.get(l.done_on)!.add(l.habit_id);
  }
  const isGood = (iso: string) => {
    const s = byDay.get(iso);
    return !!s && activeHabitIds.every((id) => s.has(id));
  };
  const d = new Date();
  if (!isGood(todayISO(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  let startISO: string | null = null;
  while (isGood(todayISO(d))) {
    startISO = todayISO(d);
    n++;
    d.setDate(d.getDate() - 1);
  }
  return { streak: n, startISO };
}

/** یک عکسِ فشرده از وضعیت کاربر برای تزریق به پرامپت‌های مربی/بریفینگ/مرور. */
export async function userSnapshot(db: DB, uid: string): Promise<UserSnapshot> {
  const today = todayISO();
  const yesterday = daysAgoISO(1);
  const weekAgo = daysAgoISO(6);
  const streakWindow = daysAgoISO(120);

  const [idnRes, habitRes, logRes, streakLogRes, missionRes, milestoneRes, mealRes, moodRes, profileRes, rewardRes, claimRes] = await Promise.all([
    db.from("identities").select("id, name").eq("user_id", uid).eq("archived", false),
    db.from("habits").select("id, name, identity_id, min_version").eq("user_id", uid).eq("archived", false),
    db.from("habit_logs").select("habit_id, done_on").eq("user_id", uid).gte("done_on", weekAgo),
    db.from("habit_logs").select("habit_id, done_on").eq("user_id", uid).gte("done_on", streakWindow),
    db.from("missions").select("id, title, end_on").eq("user_id", uid).eq("status", "active").order("created_at", { ascending: false }).limit(1),
    db.from("mission_milestones").select("mission_id, reached_at").eq("user_id", uid),
    db.from("meals").select("calories, name").eq("user_id", uid).eq("eaten_on", today),
    db.from("moods").select("score").eq("user_id", uid).eq("recorded_on", today).maybeSingle(),
    db.from("profiles").select("daily_calorie_goal").eq("user_id", uid).maybeSingle(),
    db.from("rewards").select("id, title, streak_days").eq("user_id", uid).eq("archived", false),
    db.from("reward_claims").select("reward_id, claimed_on").eq("user_id", uid),
  ]);

  const identitiesRaw = idnRes.data || [];
  const habits = habitRes.data || [];
  const logs = logRes.data || [];

  // رأی‌ها بر اساس هویت
  const habitIdentity = new Map<string, string | null>(habits.map((h) => [h.id, h.identity_id]));
  const voteTotal = new Map<string, number>();
  const voteWeek = new Map<string, number>();
  const doneTodaySet = new Set<string>();
  const doneYesterdaySet = new Set<string>();
  for (const l of logs) {
    const idn = habitIdentity.get(l.habit_id);
    if (idn) {
      voteTotal.set(idn, (voteTotal.get(idn) || 0) + 1);
      if (l.done_on >= weekAgo) voteWeek.set(idn, (voteWeek.get(idn) || 0) + 1);
    }
    if (l.done_on === today) doneTodaySet.add(l.habit_id);
    if (l.done_on === yesterday) doneYesterdaySet.add(l.habit_id);
  }

  const identities = identitiesRaw.map((i) => ({
    name: i.name as string,
    votes: voteTotal.get(i.id) || 0,
    week: voteWeek.get(i.id) || 0,
    level: levelOf(voteTotal.get(i.id) || 0),
  }));

  const doneToday = habits.filter((h) => doneTodaySet.has(h.id)).length;
  const missedYesterday = habits
    .filter((h) => !doneYesterdaySet.has(h.id) && !doneTodaySet.has(h.id))
    .map((h) => h.name as string);

  // ماموریت فعال
  const mission = missionRes.data?.[0] || null;
  let activeMission: UserSnapshot["activeMission"] = null;
  if (mission) {
    const ms = (milestoneRes.data || []).filter((m) => m.mission_id === mission.id);
    const done = ms.filter((m) => m.reached_at).length;
    let daysLeft: number | null = null;
    if (mission.end_on) {
      daysLeft = Math.max(0, Math.round((new Date(mission.end_on + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000));
    }
    activeMission = { title: mission.title as string, daysLeft, milestonesDone: done, milestonesTotal: ms.length };
  }

  const mealsToday = mealRes.data || [];
  const calToday = mealsToday.reduce((s, m) => s + (Number(m.calories) || 0), 0);
  const mealNames = mealsToday.map((m) => String(m.name || "")).filter(Boolean);
  const calGoal = profileRes.data?.daily_calorie_goal || 2000;
  const moodScore = moodRes.data?.score as number | undefined;
  const MOOD_FA = ["", "بد", "نه‌چندان", "معمولی", "خوب", "عالی"];

  // استریکِ روزهای پیاپیِ عالی + نزدیک‌ترین جایزه
  const { streak, startISO } = computeGoodStreak(habits.map((h) => h.id), streakLogRes.data || []);
  const claims = claimRes.data || [];
  const lastClaimOf = (rid: string) =>
    claims.filter((c) => c.reward_id === rid).map((c) => c.claimed_on as string).sort().pop() || null;
  const rewards = (rewardRes.data || []).map((r) => {
    const last = lastClaimOf(r.id);
    const days = Number(r.streak_days) || 0;
    const claimable = streak >= days && (!last || (startISO !== null && last < startISO));
    return { title: r.title as string, days, claimable, remaining: Math.max(0, days - streak) };
  });
  const readyReward = rewards.find((r) => r.claimable) || null;
  const nextReward = rewards
    .filter((r) => !r.claimable && r.remaining > 0)
    .sort((a, b) => a.remaining - b.remaining)[0] || null;

  // متن فشرده برای پرامپت
  const lines: string[] = [];
  if (identities.length) {
    lines.push("هویت‌ها: " + identities.map((i) => `${i.name} (سطح ${i.level}، ${i.votes} رأی، این هفته ${i.week})`).join("؛ "));
  }
  if (activeMission) {
    lines.push(`ماموریت فعال: «${activeMission.title}»` + (activeMission.daysLeft != null ? ` (${activeMission.daysLeft} روز مانده)` : "") + (activeMission.milestonesTotal ? ` — ${activeMission.milestonesDone}/${activeMission.milestonesTotal} نقطه‌عطف` : ""));
  }
  lines.push(`عادت‌های امروز: ${doneToday} از ${habits.length} انجام شده`);
  if (streak > 0) lines.push(`روزهای پیاپیِ عالی (همه‌ی عادت‌ها): ${streak}`);
  if (missedYesterday.length) lines.push(`دیروز جا موند: ${missedYesterday.slice(0, 5).join("، ")}`);
  lines.push(`کالری امروز: ${calToday} از ${calGoal}` + (mealNames.length ? ` — ${mealNames.slice(0, 6).join("، ")}` : ""));
  if (moodScore) lines.push(`حال‌وهوای امروز: ${MOOD_FA[moodScore] || moodScore}`);
  if (readyReward) lines.push(`جایزه‌ی «${readyReward.title}» آماده‌ی دریافته! تشویقش کن بره بگیردش.`);
  else if (nextReward) lines.push(`نزدیک‌ترین جایزه: «${nextReward.title}» — ${nextReward.remaining} روزِ عالیِ دیگه تا بازشدنش.`);

  return {
    text: lines.join("\n"),
    hasData: habits.length > 0 || identities.length > 0 || activeMission != null,
    identities,
    activeMission,
    habits: { total: habits.length, doneToday, missedYesterday },
    streak,
  };
}
