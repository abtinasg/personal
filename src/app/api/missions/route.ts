import { authed, ok, bad } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  const a = await authed();
  if ("error" in a) return a.error;

  const [{ data: missions, error }, { data: milestones }, { data: links }] = await Promise.all([
    a.db.from("missions").select("*").eq("user_id", a.uid).order("created_at", { ascending: false }),
    a.db.from("mission_milestones").select("*").eq("user_id", a.uid).order("order_index"),
    a.db.from("mission_habits").select("mission_id, habit_id").eq("user_id", a.uid),
  ]);
  if (error) return bad(error.message, 500);

  const msByMission = new Map<string, any[]>();
  for (const m of milestones || []) {
    if (!msByMission.has(m.mission_id)) msByMission.set(m.mission_id, []);
    msByMission.get(m.mission_id)!.push(m);
  }
  const habitsByMission = new Map<string, string[]>();
  for (const l of links || []) {
    if (!habitsByMission.has(l.mission_id)) habitsByMission.set(l.mission_id, []);
    habitsByMission.get(l.mission_id)!.push(l.habit_id);
  }

  const result = (missions || []).map((m) => ({
    ...m,
    milestones: msByMission.get(m.id) || [],
    habit_ids: habitsByMission.get(m.id) || [],
  }));

  return ok({ missions: result });
}

export async function POST(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const b = await req.json().catch(() => ({}));
  const title = String(b.title || "").trim();
  if (!title) return bad("عنوان ماموریت لازم است.");

  const { data: mission, error } = await a.db
    .from("missions")
    .insert({
      user_id: a.uid,
      title,
      why: b.why ? String(b.why) : null,
      emoji: b.emoji || "rocket",
      color: b.color || "#5e5ce6",
      identity_id: b.identity_id || null,
      start_on: b.start_on || undefined,
      end_on: b.end_on || null,
      target_label: b.target_label ? String(b.target_label) : null,
      target_value: b.target_value != null ? Number(b.target_value) : null,
      target_unit: b.target_unit ? String(b.target_unit) : null,
    })
    .select()
    .single();
  if (error) return bad(error.message, 500);

  const milestones: string[] = Array.isArray(b.milestones) ? b.milestones : [];
  if (milestones.length) {
    await a.db.from("mission_milestones").insert(
      milestones
        .map((t) => String(t).trim())
        .filter(Boolean)
        .map((title, i) => ({ user_id: a.uid, mission_id: mission.id, title, order_index: i }))
    );
  }

  const habitIds: string[] = Array.isArray(b.habit_ids) ? b.habit_ids : [];
  if (habitIds.length) {
    await a.db
      .from("mission_habits")
      .insert(habitIds.map((habit_id) => ({ user_id: a.uid, mission_id: mission.id, habit_id })));
  }

  return ok({ mission });
}

export async function PUT(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const b = await req.json().catch(() => ({}));

  // حالت ۱: تیک‌زدن/برداشتن یک نقطه‌عطف
  if (b.milestoneId) {
    const reached = b.reached ? new Date().toISOString() : null;
    const { error } = await a.db
      .from("mission_milestones")
      .update({ reached_at: reached })
      .eq("id", b.milestoneId)
      .eq("user_id", a.uid);
    if (error) return bad(error.message, 500);
    return ok();
  }

  // حالت ۲: به‌روزرسانی خود ماموریت
  if (!b.id) return bad("شناسه لازم است.");
  const patch: Record<string, unknown> = {};
  for (const k of ["title", "why", "emoji", "color", "identity_id", "end_on", "target_label", "target_unit", "status"]) {
    if (b[k] !== undefined) patch[k] = b[k];
  }
  if (b.target_value !== undefined) patch.target_value = b.target_value != null ? Number(b.target_value) : null;

  const { data, error } = await a.db
    .from("missions")
    .update(patch)
    .eq("id", b.id)
    .eq("user_id", a.uid)
    .select()
    .single();
  if (error) return bad(error.message, 500);

  // اتصال عادت‌ها (در صورت ارسال) را جایگزین کن
  if (Array.isArray(b.habit_ids)) {
    await a.db.from("mission_habits").delete().eq("mission_id", b.id).eq("user_id", a.uid);
    if (b.habit_ids.length) {
      await a.db
        .from("mission_habits")
        .insert(b.habit_ids.map((habit_id: string) => ({ user_id: a.uid, mission_id: b.id, habit_id })));
    }
  }

  return ok({ mission: data });
}

export async function DELETE(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return bad("شناسه لازم است.");
  const { error } = await a.db.from("missions").delete().eq("id", id).eq("user_id", a.uid);
  if (error) return bad(error.message, 500);
  return ok();
}
