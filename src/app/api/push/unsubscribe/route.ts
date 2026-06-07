import { authed, ok, bad } from "@/lib/api";

export const runtime = "nodejs";

/** حذفِ اشتراکِ نوتیفیکیشنِ این دستگاه. */
export async function POST(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;

  const b = await req.json().catch(() => ({}));
  const endpoint = typeof b?.endpoint === "string" ? b.endpoint : "";
  if (!endpoint) return bad("endpoint لازم است.");

  await a.db.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", a.uid);
  return ok();
}
