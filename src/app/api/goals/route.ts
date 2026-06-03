import { authed, ok, bad } from "@/lib/api";

export const runtime = "nodejs";

const DENOMS = new Set(["toman", "usd", "gold", "coin"]);

export async function GET() {
  const a = await authed();
  if ("error" in a) return a.error;

  const { data, error } = await a.db
    .from("purchase_goals")
    .select("*")
    .eq("user_id", a.uid)
    .neq("status", "archived")
    .order("created_at", { ascending: false });

  if (error) return bad(error.message, 500);
  return ok({ goals: data });
}

export async function POST(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const b = await req.json().catch(() => ({}));

  const target = Number(b.target_native);
  if (!target || target <= 0) return bad("مقدارِ هدف معتبر لازم است.");
  const title = String(b.title || "").trim();
  if (!title) return bad("عنوانِ هدف لازم است.");
  const denom = DENOMS.has(b.denom) ? b.denom : "toman";

  const { data, error } = await a.db
    .from("purchase_goals")
    .insert({
      user_id: a.uid,
      title: title.slice(0, 80),
      emoji: String(b.emoji || "target").slice(0, 24),
      denom,
      target_native: target,
      saved_toman: Math.max(0, Number(b.saved_toman) || 0),
      target_date: b.target_date || null,
      note: b.note ? String(b.note).slice(0, 240) : null,
      status: "active",
    })
    .select()
    .single();

  if (error) return bad(error.message, 500);
  return ok({ goal: data });
}

export async function PUT(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "");
  if (!id) return bad("شناسه لازم است.");

  const patch: Record<string, unknown> = {};
  if (b.saved_toman != null) patch.saved_toman = Math.max(0, Number(b.saved_toman) || 0);
  if (b.target_native != null && Number(b.target_native) > 0) patch.target_native = Number(b.target_native);
  if (b.status && ["active", "reached", "archived"].includes(b.status)) patch.status = b.status;
  if (b.title != null) patch.title = String(b.title).slice(0, 80);
  if (b.note != null) patch.note = b.note ? String(b.note).slice(0, 240) : null;
  if (b.target_date !== undefined) patch.target_date = b.target_date || null;
  if (!Object.keys(patch).length) return bad("چیزی برای به‌روزرسانی نیست.");

  const { data, error } = await a.db
    .from("purchase_goals")
    .update(patch)
    .eq("id", id)
    .eq("user_id", a.uid)
    .select()
    .single();

  if (error) return bad(error.message, 500);
  return ok({ goal: data });
}

export async function DELETE(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return bad("شناسه لازم است.");
  const { error } = await a.db.from("purchase_goals").delete().eq("id", id).eq("user_id", a.uid);
  if (error) return bad(error.message, 500);
  return ok();
}
