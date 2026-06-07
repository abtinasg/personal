import { authed, ok } from "@/lib/api";
import { FREE_DAILY, getWallet, getActiveSubscription } from "@/lib/billing";

export const runtime = "nodejs";

export async function GET() {
  const a = await authed();
  if ("error" in a) return a.error;

  const credits = await getWallet(a.db, a.uid);
  const plan = await getActiveSubscription(a.db, a.uid);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { count } = await a.db
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", a.uid)
    .gte("created_at", startOfDay.toISOString());

  const { data: ledger } = await a.db
    .from("credit_ledger")
    .select("delta, reason, balance_after, created_at")
    .eq("user_id", a.uid)
    .order("created_at", { ascending: false })
    .limit(20);

  return ok({
    credits,
    freeUsedToday: count ?? 0,
    freeDaily: FREE_DAILY,
    plan,
    ledger: ledger ?? [],
  });
}
