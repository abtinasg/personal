import { authed, ok, bad } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const limit = Math.min(Number(searchParams.get("limit")) || 200, 500);

  let q = a.db.from("meals").select("*").eq("user_id", a.uid).order("created_at", { ascending: false });
  if (date) q = q.eq("eaten_on", date);
  q = q.limit(limit);

  const { data, error } = await q;
  if (error) return bad(error.message, 500);
  return ok({ meals: data });
}

export async function POST(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const b = await req.json().catch(() => ({}));

  const name = String(b.name || "").trim();
  if (!name) return bad("نام وعده لازم است.");

  const { data, error } = await a.db
    .from("meals")
    .insert({
      user_id: a.uid,
      name,
      calories: Math.max(0, Math.round(Number(b.calories) || 0)),
      protein: Number(b.protein) || 0,
      carbs: Number(b.carbs) || 0,
      fat: Number(b.fat) || 0,
      meal_type: b.meal_type || "snack",
      eaten_on: b.date || undefined,
    })
    .select()
    .single();

  if (error) return bad(error.message, 500);
  return ok({ meal: data });
}

export async function DELETE(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return bad("شناسه لازم است.");

  const { error } = await a.db.from("meals").delete().eq("id", id).eq("user_id", a.uid);
  if (error) return bad(error.message, 500);
  return ok();
}
