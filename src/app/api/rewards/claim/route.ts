import { authed, ok, bad } from "@/lib/api";
import { computeGoodStreak } from "@/lib/coach";
import { daysAgoISO, todayISO } from "@/lib/format";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const b = await req.json().catch(() => ({}));
  const rewardId = String(b.rewardId || b.reward_id || "").trim();
  if (!rewardId) return bad("شناسه‌ی جایزه لازم است.");

  const { data: reward, error: rErr } = await a.db
    .from("rewards")
    .select("id, title, streak_days")
    .eq("id", rewardId)
    .eq("user_id", a.uid)
    .maybeSingle();
  if (rErr) return bad(rErr.message, 500);
  if (!reward) return bad("این جایزه پیدا نشد.", 404);

  // استریک و آخرین دریافت را از سرور محاسبه می‌کنیم تا قابلِ‌دستکاری نباشد.
  const [habitRes, logRes, claimRes] = await Promise.all([
    a.db.from("habits").select("id").eq("user_id", a.uid).eq("archived", false),
    a.db.from("habit_logs").select("habit_id, done_on").eq("user_id", a.uid).gte("done_on", daysAgoISO(120)),
    a.db.from("reward_claims").select("claimed_on").eq("user_id", a.uid).eq("reward_id", rewardId),
  ]);
  const ids = (habitRes.data || []).map((h) => h.id as string);
  const { streak, startISO } = computeGoodStreak(ids, logRes.data || []);
  const days = Number(reward.streak_days) || 0;

  if (streak < days) {
    return bad(`هنوز ${Math.max(0, days - streak)} روزِ عالیِ دیگه مونده تا این جایزه باز شه.`);
  }
  const lastClaim = (claimRes.data || []).map((c) => c.claimed_on as string).sort().pop() || null;
  if (lastClaim != null && startISO != null && lastClaim >= startISO) {
    return bad("این جایزه رو تو همین دوره‌ی استریک گرفتی. یه استریکِ تازه بساز تا دوباره باز شه.");
  }

  const { data, error } = await a.db
    .from("reward_claims")
    .insert({ user_id: a.uid, reward_id: rewardId, claimed_on: todayISO(), streak_at: streak })
    .select()
    .single();
  if (error) return bad(error.message, 500);
  return ok({ claim: data, streak });
}
