import { authed, ok, bad } from "@/lib/api";
import type { MissionPlan } from "@/app/api/missions/generate/route";

export const runtime = "nodejs";

function addDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

/** نقشه‌ی ماموریت (احتمالاً ویرایش‌شده) را به هویت + عادت‌ها + ماموریت تبدیل و ذخیره می‌کند. */
export async function POST(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const b = await req.json().catch(() => ({}));
  const plan = b.plan as MissionPlan | undefined;
  if (!plan?.title) return bad("نقشه‌ی ماموریت نامعتبر است.");

  // ۱) هویت
  let identityId: string | null = b.identity_id || null;
  let identityColor = plan.color;
  if (!identityId && plan.identity?.name) {
    const { data: idn, error } = await a.db
      .from("identities")
      .insert({
        user_id: a.uid,
        name: plan.identity.name,
        statement: plan.identity.statement || null,
        emoji: plan.identity.emoji || "star",
        color: plan.color,
      })
      .select()
      .single();
    if (error) return bad("ساخت هویت ناموفق بود: " + error.message, 500);
    identityId = idn.id;
    identityColor = idn.color;
  } else if (identityId) {
    const { data: idn } = await a.db.from("identities").select("color").eq("id", identityId).eq("user_id", a.uid).maybeSingle();
    if (idn?.color) identityColor = idn.color;
  }

  // ۲) عادت‌ها
  const habits = Array.isArray(plan.habits) ? plan.habits : [];
  let habitIds: string[] = [];
  if (habits.length) {
    const { data: created, error } = await a.db
      .from("habits")
      .insert(
        habits.map((h) => ({
          user_id: a.uid,
          name: h.name,
          emoji: h.emoji || "check",
          color: identityColor,
          identity_id: identityId,
          cue: h.cue || null,
          min_version: h.min_version || null,
        }))
      )
      .select("id");
    if (error) return bad("ساخت عادت‌ها ناموفق بود: " + error.message, 500);
    habitIds = (created || []).map((h) => h.id);
  }

  // ۳) ماموریت
  const { data: mission, error: mErr } = await a.db
    .from("missions")
    .insert({
      user_id: a.uid,
      title: plan.title,
      why: plan.why || null,
      emoji: plan.emoji || "rocket",
      color: plan.color,
      identity_id: identityId,
      end_on: addDaysISO(plan.duration_days || 90),
      target_label: plan.target_label,
      target_value: plan.target_value,
      target_unit: plan.target_unit,
    })
    .select()
    .single();
  if (mErr) return bad("ساخت ماموریت ناموفق بود: " + mErr.message, 500);

  // ۴) نقاط‌عطف
  const milestones = Array.isArray(plan.milestones) ? plan.milestones : [];
  if (milestones.length) {
    await a.db.from("mission_milestones").insert(
      milestones.map((title, i) => ({ user_id: a.uid, mission_id: mission.id, title, order_index: i }))
    );
  }

  // ۵) اتصال عادت‌ها
  if (habitIds.length) {
    await a.db
      .from("mission_habits")
      .insert(habitIds.map((habit_id) => ({ user_id: a.uid, mission_id: mission.id, habit_id })));
  }

  return ok({ missionId: mission.id });
}
