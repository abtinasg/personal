import { authed, ok, bad } from "@/lib/api";
import { computeGoodStreak } from "@/lib/coach";
import { daysAgoISO } from "@/lib/format";

export const runtime = "nodejs";

/** استریکِ فعلی + هویتِ هر جایزه (قابلِ‌دریافت؟) را برمی‌گرداند. */
async function loadStreak(db: ReturnType<typeof import("@/lib/supabase").getServiceClient>, uid: string) {
  const [habitRes, logRes] = await Promise.all([
    db.from("habits").select("id").eq("user_id", uid).eq("archived", false),
    db.from("habit_logs").select("habit_id, done_on").eq("user_id", uid).gte("done_on", daysAgoISO(120)),
  ]);
  const ids = (habitRes.data || []).map((h) => h.id as string);
  return computeGoodStreak(ids, logRes.data || []);
}

export async function GET() {
  const a = await authed();
  if ("error" in a) return a.error;

  const [{ streak, startISO }, rewardRes, claimRes] = await Promise.all([
    loadStreak(a.db, a.uid),
    a.db.from("rewards").select("*").eq("user_id", a.uid).eq("archived", false).order("streak_days", { ascending: true }).order("created_at", { ascending: true }),
    a.db.from("reward_claims").select("reward_id, claimed_on").eq("user_id", a.uid),
  ]);

  const claims = claimRes.data || [];
  const rewards = (rewardRes.data || []).map((r) => {
    const mine = claims.filter((c) => c.reward_id === r.id).map((c) => c.claimed_on as string).sort();
    const last = mine.length ? mine[mine.length - 1] : null;
    const days = Number(r.streak_days) || 0;
    const claimedInStreak = last != null && startISO != null && last >= startISO;
    const claimable = streak >= days && !claimedInStreak;
    return {
      ...r,
      claimable,
      claimed_in_streak: claimedInStreak,
      last_claimed_on: last,
      total_claims: mine.length,
    };
  });

  return ok({ streak, streak_start: startISO, rewards });
}

export async function POST(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const b = await req.json().catch(() => ({}));
  const title = String(b.title || "").trim();
  if (!title) return bad("یه اسم برای جایزه بنویس.");

  const { data, error } = await a.db
    .from("rewards")
    .insert({
      user_id: a.uid,
      title,
      emoji: b.emoji || "gift",
      color: b.color || "#ff9f0a",
      streak_days: Math.max(1, Math.round(Number(b.streak_days) || 5)),
    })
    .select()
    .single();
  if (error) return bad(error.message, 500);
  return ok({ reward: data });
}

export async function PUT(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const b = await req.json().catch(() => ({}));
  if (!b.id) return bad("شناسه لازم است.");

  const patch: Record<string, unknown> = {};
  if (b.title != null) patch.title = String(b.title).trim();
  if (b.emoji != null) patch.emoji = String(b.emoji);
  if (b.color != null) patch.color = String(b.color);
  if (b.streak_days != null) patch.streak_days = Math.max(1, Math.round(Number(b.streak_days) || 5));

  const { data, error } = await a.db
    .from("rewards")
    .update(patch)
    .eq("id", b.id)
    .eq("user_id", a.uid)
    .select()
    .single();
  if (error) return bad(error.message, 500);
  return ok({ reward: data });
}

export async function DELETE(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return bad("شناسه لازم است.");
  const { error } = await a.db.from("rewards").delete().eq("id", id).eq("user_id", a.uid);
  if (error) return bad(error.message, 500);
  return ok();
}
