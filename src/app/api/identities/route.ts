import { authed, ok, bad } from "@/lib/api";
import { daysAgoISO } from "@/lib/format";

export const runtime = "nodejs";

export async function GET() {
  const a = await authed();
  if ("error" in a) return a.error;

  const [{ data: identities, error }, { data: habits }, { data: logs }] = await Promise.all([
    a.db.from("identities").select("*").eq("user_id", a.uid).eq("archived", false).order("created_at"),
    a.db.from("habits").select("id, identity_id").eq("user_id", a.uid).eq("archived", false),
    a.db.from("habit_logs").select("habit_id, done_on").eq("user_id", a.uid),
  ]);
  if (error) return bad(error.message, 500);

  const habitIdentity = new Map<string, string | null>();
  const countByIdentity = new Map<string, number>();
  for (const h of habits || []) {
    habitIdentity.set(h.id, h.identity_id);
    if (h.identity_id) countByIdentity.set(h.identity_id, (countByIdentity.get(h.identity_id) || 0) + 1);
  }

  const weekAgo = daysAgoISO(6);
  const total = new Map<string, number>();
  const week = new Map<string, number>();
  for (const l of logs || []) {
    const idn = habitIdentity.get(l.habit_id);
    if (!idn) continue;
    total.set(idn, (total.get(idn) || 0) + 1);
    if (l.done_on >= weekAgo) week.set(idn, (week.get(idn) || 0) + 1);
  }

  const result = (identities || []).map((i) => ({
    ...i,
    vote_total: total.get(i.id) || 0,
    vote_week: week.get(i.id) || 0,
    habit_count: countByIdentity.get(i.id) || 0,
  }));

  return ok({ identities: result });
}

export async function POST(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const b = await req.json().catch(() => ({}));
  const name = String(b.name || "").trim();
  if (!name) return bad("نام هویت لازم است.");

  const { data, error } = await a.db
    .from("identities")
    .insert({
      user_id: a.uid,
      name,
      statement: b.statement ? String(b.statement) : null,
      emoji: b.emoji || "star",
      color: b.color || "#0a84ff",
    })
    .select()
    .single();
  if (error) return bad(error.message, 500);
  return ok({ identity: data });
}

export async function PUT(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const b = await req.json().catch(() => ({}));
  if (!b.id) return bad("شناسه لازم است.");

  const patch: Record<string, unknown> = {};
  if (b.name != null) patch.name = String(b.name);
  if (b.statement !== undefined) patch.statement = b.statement ? String(b.statement) : null;
  if (b.emoji != null) patch.emoji = String(b.emoji);
  if (b.color != null) patch.color = String(b.color);

  const { data, error } = await a.db
    .from("identities")
    .update(patch)
    .eq("id", b.id)
    .eq("user_id", a.uid)
    .select()
    .single();
  if (error) return bad(error.message, 500);
  return ok({ identity: data });
}

export async function DELETE(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return bad("شناسه لازم است.");
  const { error } = await a.db.from("identities").delete().eq("id", id).eq("user_id", a.uid);
  if (error) return bad(error.message, 500);
  return ok();
}
