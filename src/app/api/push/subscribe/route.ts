import { authed, ok, bad } from "@/lib/api";

export const runtime = "nodejs";

/** ذخیره/به‌روزرسانیِ اشتراکِ نوتیفیکیشنِ این دستگاه برای کاربرِ فعلی. */
export async function POST(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;

  const b = await req.json().catch(() => ({}));
  const endpoint = typeof b?.endpoint === "string" ? b.endpoint : "";
  const p256dh = b?.keys?.p256dh;
  const auth = b?.keys?.auth;
  if (!endpoint || !p256dh || !auth) return bad("اطلاعاتِ اشتراکِ ناقص است.");

  const { error } = await a.db
    .from("push_subscriptions")
    .upsert({ endpoint, user_id: a.uid, p256dh, auth }, { onConflict: "endpoint" });
  if (error) return bad(error.message, 500);

  return ok();
}
