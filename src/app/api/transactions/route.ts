import { authed, ok, bad } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const limit = Math.min(Number(searchParams.get("limit")) || 200, 500);

  let q = a.db
    .from("transactions")
    .select("*")
    .eq("user_id", a.uid)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (from) q = q.gte("occurred_on", from);
  if (to) q = q.lte("occurred_on", to);
  q = q.limit(limit);

  const { data, error } = await q;
  if (error) return bad(error.message, 500);
  return ok({ transactions: data });
}

export async function POST(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const b = await req.json().catch(() => ({}));

  const amount = Number(b.amount);
  if (!amount || amount <= 0) return bad("مبلغ معتبر لازم است.");

  const { data, error } = await a.db
    .from("transactions")
    .insert({
      user_id: a.uid,
      kind: b.kind === "income" ? "income" : "expense",
      amount,
      category: String(b.category || "سایر"),
      note: b.note ? String(b.note) : null,
      occurred_on: b.date || undefined,
    })
    .select()
    .single();

  if (error) return bad(error.message, 500);
  return ok({ transaction: data });
}

export async function DELETE(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return bad("شناسه لازم است.");
  const { error } = await a.db.from("transactions").delete().eq("id", id).eq("user_id", a.uid);
  if (error) return bad(error.message, 500);
  return ok();
}
