import { authed, ok, bad } from "@/lib/api";

export const runtime = "nodejs";

/** عادتِ یک روز را تیک می‌زند یا برمی‌دارد. */
export async function POST(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const b = await req.json().catch(() => ({}));
  const habitId = String(b.habitId || "");
  const date = String(b.date || "");
  if (!habitId || !date) return bad("habitId و date لازم است.");

  // مالکیت عادت را بررسی کن
  const { data: habit } = await a.db
    .from("habits")
    .select("id")
    .eq("id", habitId)
    .eq("user_id", a.uid)
    .maybeSingle();
  if (!habit) return bad("عادت یافت نشد.", 404);

  const { data: existing } = await a.db
    .from("habit_logs")
    .select("id")
    .eq("habit_id", habitId)
    .eq("done_on", date)
    .maybeSingle();

  if (existing) {
    await a.db.from("habit_logs").delete().eq("id", existing.id);
    return ok({ done: false });
  }

  const { error } = await a.db
    .from("habit_logs")
    .insert({ user_id: a.uid, habit_id: habitId, done_on: date, count: 1 });
  if (error) return bad(error.message, 500);
  return ok({ done: true });
}
