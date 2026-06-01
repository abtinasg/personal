import { authed, ok, bad } from "@/lib/api";

export const runtime = "nodejs";

const KINDS = ["weight", "water", "sleep", "steps"];

export async function GET(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind");
  const from = searchParams.get("from");

  let q = a.db
    .from("health_metrics")
    .select("*")
    .eq("user_id", a.uid)
    .order("recorded_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (kind) q = q.eq("kind", kind);
  if (from) q = q.gte("recorded_on", from);

  const { data, error } = await q;
  if (error) return bad(error.message, 500);
  return ok({ metrics: data });
}

export async function POST(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const b = await req.json().catch(() => ({}));

  if (!KINDS.includes(b.kind)) return bad("نوع متریک نامعتبر است.");
  const value = Number(b.value);
  if (isNaN(value)) return bad("مقدار معتبر لازم است.");

  const { data, error } = await a.db
    .from("health_metrics")
    .insert({ user_id: a.uid, kind: b.kind, value, recorded_on: b.date || undefined })
    .select()
    .single();

  if (error) return bad(error.message, 500);
  return ok({ metric: data });
}

export async function DELETE(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return bad("شناسه لازم است.");
  const { error } = await a.db.from("health_metrics").delete().eq("id", id).eq("user_id", a.uid);
  if (error) return bad(error.message, 500);
  return ok();
}
