import { authed, ok, bad } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from"); // برای محاسبه‌ی استریک، لاگ‌های اخیر

  const { data: habits, error } = await a.db
    .from("habits")
    .select("*")
    .eq("user_id", a.uid)
    .eq("archived", false)
    .order("created_at", { ascending: true });
  if (error) return bad(error.message, 500);

  let logsQ = a.db.from("habit_logs").select("*").eq("user_id", a.uid);
  if (from) logsQ = logsQ.gte("done_on", from);
  const { data: logs } = await logsQ;

  return ok({ habits, logs: logs || [] });
}

export async function POST(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const b = await req.json().catch(() => ({}));
  const name = String(b.name || "").trim();
  if (!name) return bad("نام عادت لازم است.");

  const { data, error } = await a.db
    .from("habits")
    .insert({
      user_id: a.uid,
      name,
      emoji: b.emoji || "check",
      color: b.color || "#34c759",
      target_per_day: Math.max(1, Math.round(Number(b.target_per_day) || 1)),
      identity_id: b.identity_id || null,
      cue: b.cue ? String(b.cue) : null,
      min_version: b.min_version ? String(b.min_version) : null,
    })
    .select()
    .single();
  if (error) return bad(error.message, 500);
  return ok({ habit: data });
}

export async function PUT(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const b = await req.json().catch(() => ({}));
  if (!b.id) return bad("شناسه لازم است.");

  const patch: Record<string, unknown> = {};
  if (b.name != null) patch.name = String(b.name).trim();
  if (b.emoji != null) patch.emoji = String(b.emoji);
  if (b.color != null) patch.color = String(b.color);
  if (b.identity_id !== undefined) patch.identity_id = b.identity_id || null;
  if (b.cue !== undefined) patch.cue = b.cue ? String(b.cue) : null;
  if (b.min_version !== undefined) patch.min_version = b.min_version ? String(b.min_version) : null;

  const { data, error } = await a.db
    .from("habits")
    .update(patch)
    .eq("id", b.id)
    .eq("user_id", a.uid)
    .select()
    .single();
  if (error) return bad(error.message, 500);
  return ok({ habit: data });
}

export async function DELETE(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return bad("شناسه لازم است.");
  const { error } = await a.db.from("habits").delete().eq("id", id).eq("user_id", a.uid);
  if (error) return bad(error.message, 500);
  return ok();
}
