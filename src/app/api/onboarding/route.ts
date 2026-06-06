import { authed, ok, bad } from "@/lib/api";

export const runtime = "nodejs";

/**
 * پایانِ انبوردینگِ کاربرِ جدید — همه‌ی مشخصاتِ پایه را در یک رفت‌وبرگشت ذخیره می‌کند:
 *  • اسمِ نمایشی (users.display_name)
 *  • قد/جنسیت/سال‌تولد/سطحِ فعالیت (profiles) + پرچمِ onboarded
 *  • وزنِ فعلی (health_metrics)
 * این‌ها همان داده‌هایی‌اند که «برنامه‌ی هوشمندِ تغذیه» برای BMI/کالری لازم دارد.
 */
export async function POST(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const b = await req.json().catch(() => ({}));

  const name = String(b.name ?? "").trim().slice(0, 60);
  const height = Number(b.height_cm);
  const weight = Number(b.weight);
  const birthYear = Math.round(Number(b.birth_year));
  const sex = b.sex === "female" ? "female" : b.sex === "male" ? "male" : null;
  const activity = typeof b.activity_level === "string" ? b.activity_level : "light";
  const thisYear = new Date().getFullYear();

  if (!name) return bad("اسم لازم است.");
  if (!sex) return bad("جنسیت لازم است.");
  if (!height || height < 80 || height > 250) return bad("قد معتبر لازم است.");
  if (!weight || weight < 25 || weight > 400) return bad("وزن معتبر لازم است.");
  if (!birthYear || birthYear < 1900 || birthYear > thisYear - 5) return bad("سال تولد معتبر لازم است.");

  const { error: userErr } = await a.db.from("users").update({ display_name: name }).eq("id", a.uid);
  if (userErr) return bad(userErr.message, 500);

  const { error: profErr } = await a.db
    .from("profiles")
    .upsert(
      {
        user_id: a.uid,
        height_cm: height,
        sex,
        birth_year: birthYear,
        activity_level: activity,
        onboarded: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  if (profErr) return bad(profErr.message, 500);

  const { error: weightErr } = await a.db
    .from("health_metrics")
    .insert({ user_id: a.uid, kind: "weight", value: weight });
  if (weightErr) return bad(weightErr.message, 500);

  const bmi = Math.round((weight / Math.pow(height / 100, 2)) * 10) / 10;
  return ok({ ok: true, bmi });
}
