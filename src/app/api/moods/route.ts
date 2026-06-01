import { authed, ok, bad } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const from = new URL(req.url).searchParams.get("from");

  let q = a.db.from("moods").select("*").eq("user_id", a.uid).order("recorded_on", { ascending: false });
  if (from) q = q.gte("recorded_on", from);

  const { data, error } = await q;
  if (error) return bad(error.message, 500);
  return ok({ moods: data });
}

export async function POST(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const b = await req.json().catch(() => ({}));
  const score = Math.round(Number(b.score));
  if (!(score >= 1 && score <= 5)) return bad("امتیاز حال باید بین ۱ تا ۵ باشد.");
  const date = b.date || new Date().toISOString().slice(0, 10);

  // upsert بر اساس (user_id, recorded_on)
  const { data, error } = await a.db
    .from("moods")
    .upsert(
      { user_id: a.uid, score, note: b.note ? String(b.note) : null, recorded_on: date },
      { onConflict: "user_id,recorded_on" }
    )
    .select()
    .single();

  if (error) return bad(error.message, 500);
  return ok({ mood: data });
}
