import { authed, ok, bad } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — جزئیاتِ یک تیکتِ کاربرِ خودش (با تاریخچه‌ی پیام‌ها، بدونِ یادداشت‌های داخلی). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await authed();
  if ("error" in a) return a.error;

  const { id } = await params;

  const { data: ticket, error } = await a.db
    .from("support_tickets")
    .select("id, user_id, subject, body, category, priority, status, created_at, updated_at, resolved_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return bad(error.message, 500);
  if (!ticket || (ticket as { user_id: string }).user_id !== a.uid) {
    return bad("تیکت پیدا نشد.", 404);
  }

  const { data: messages } = await a.db
    .from("support_messages")
    .select("id, author_type, author_name, body, created_at")
    .eq("ticket_id", id)
    .eq("is_internal", false)
    .order("created_at", { ascending: true });

  return ok({ ticket, messages: messages ?? [] });
}

type ReplyBody = { body?: string };

/** POST — پاسخِ کاربر به تیکتِ خودش (در عمل = یک پیامِ جدید). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await authed();
  if ("error" in a) return a.error;
  const { id } = await params;

  const b = (await req.json().catch(() => ({}))) as ReplyBody;
  const body = (b.body || "").trim();
  if (body.length < 1) return bad("متنِ پیام خالی است.");
  if (body.length > 5000) return bad("پیام بیش‌از‌حد طولانی است.");

  // تأییدِ مالکیتِ تیکت
  const { data: ticket } = await a.db
    .from("support_tickets")
    .select("user_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!ticket || (ticket as { user_id: string }).user_id !== a.uid) {
    return bad("تیکت پیدا نشد.", 404);
  }

  const { data: u } = await a.db
    .from("users")
    .select("display_name, username")
    .eq("id", a.uid)
    .maybeSingle();
  const authorName = (u?.display_name as string) || (u?.username as string) || "کاربر";

  await a.db.from("support_messages").insert({
    ticket_id: id,
    author_type: "user",
    author_name: authorName,
    body,
  });

  // اگر تیکت waiting_user بود، با پاسخِ کاربر برمی‌گرده به open
  if ((ticket as { status: string }).status === "waiting_user") {
    await a.db.from("support_tickets").update({ status: "open" }).eq("id", id);
  }

  return ok();
}
