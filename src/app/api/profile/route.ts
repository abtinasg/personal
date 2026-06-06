import { authed, ok, bad } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  const a = await authed();
  if ("error" in a) return a.error;

  let { data } = await a.db.from("profiles").select("*").eq("user_id", a.uid).maybeSingle();
  if (!data) {
    const ins = await a.db.from("profiles").insert({ user_id: a.uid }).select().single();
    data = ins.data;
  }
  return ok({ profile: data });
}

export async function PUT(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const b = await req.json().catch(() => ({}));

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (b.daily_calorie_goal != null) patch.daily_calorie_goal = Math.max(0, Math.round(Number(b.daily_calorie_goal)));
  if (b.monthly_budget != null) patch.monthly_budget = Math.max(0, Number(b.monthly_budget));
  if (b.water_goal_ml != null) patch.water_goal_ml = Math.max(0, Math.round(Number(b.water_goal_ml)));
  if (b.weight_goal != null) patch.weight_goal = Number(b.weight_goal);
  if (b.currency != null) patch.currency = String(b.currency);
  if (b.height_cm !== undefined) patch.height_cm = b.height_cm != null ? Number(b.height_cm) : null;
  if (b.sex !== undefined) patch.sex = b.sex === "male" || b.sex === "female" ? b.sex : null;
  if (b.birth_year !== undefined) patch.birth_year = b.birth_year != null ? Math.round(Number(b.birth_year)) : null;
  if (b.activity_level !== undefined) patch.activity_level = b.activity_level ? String(b.activity_level) : null;
  if (b.onboarded !== undefined) patch.onboarded = !!b.onboarded;

  // ترجیحاتِ ورزشی
  if (b.fitness_goal !== undefined) patch.fitness_goal = b.fitness_goal ? String(b.fitness_goal) : null;
  if (b.fitness_level !== undefined) patch.fitness_level = b.fitness_level ? String(b.fitness_level) : null;
  if (b.workout_days !== undefined) patch.workout_days = b.workout_days != null ? Math.min(7, Math.max(1, Math.round(Number(b.workout_days)))) : null;
  if (b.workout_location !== undefined) patch.workout_location = b.workout_location ? String(b.workout_location) : null;
  if (b.workout_equipment !== undefined) patch.workout_equipment = b.workout_equipment ? String(b.workout_equipment).slice(0, 300) : null;
  if (b.workout_minutes !== undefined) patch.workout_minutes = b.workout_minutes != null ? Math.min(180, Math.max(10, Math.round(Number(b.workout_minutes)))) : null;
  if (b.workout_limits !== undefined) patch.workout_limits = b.workout_limits ? String(b.workout_limits).slice(0, 300) : null;

  const { data, error } = await a.db
    .from("profiles")
    .upsert({ user_id: a.uid, ...patch }, { onConflict: "user_id" })
    .select()
    .single();
  if (error) return bad(error.message, 500);
  return ok({ profile: data });
}
