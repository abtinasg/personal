import { adminAuthed, ok, bad } from "@/lib/api";
import { logAudit, clientIp } from "@/lib/audit";
import { isCategory, isPriority, isStatus } from "@/lib/support";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — جزئیاتِ کاملِ یک تیکت + همه‌ی پیام‌ها (شامل یادداشت‌های داخلی). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await adminAuthed();
  if ("error" in a) return a.error;
  const { id } = await params;

  const { data: ticket, error } = await a.db
    .from("support_tickets")
    .select("id, user_id, contact, subject, body, category, priority, status, assigned_to, meta, created_at, updated_at, resolved_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return bad(error.message, 500);
  if (!ticket) return bad("تیکت پیدا نشد.", 404);

  const tk = ticket as { user_id: string | null };
  let user: { username?: string; display_name?: string; phone?: string } | null = null;
  if (tk.user_id) {
    const { data: u } = await a.db
      .from("users")
      .select("username, display_name, phone")
      .eq("id", tk.user_id)
      .maybeSingle();
    user = (u as typeof user) || null;
  }

  const { data: messages } = await a.db
    .from("support_messages")
    .select("id, author_type, author_name, body, is_internal, created_at")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

  return ok({ ticket, user, messages: messages ?? [] });
}

type PatchBody = {
  status?: string;
  priority?: string;
  category?: string;
  assigned_to?: string | null;
};

/** PATCH — بروزرسانیِ وضعیت/اولویت/دسته/مسئولِ تیکت. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await adminAuthed();
  if ("error" in a) return a.error;
  const { id } = await params;

  const b = (await req.json().catch(() => ({}))) as PatchBody;
  const patch: Record<string, unknown> = {};
  if (b.status !== undefined) {
    if (!isStatus(b.status)) return bad("وضعیتِ نامعتبر.");
    patch.status = b.status;
  }
  if (b.priority !== undefined) {
    if (!isPriority(b.priority)) return bad("اولویتِ نامعتبر.");
    patch.priority = b.priority;
  }
  if (b.category !== undefined) {
    if (!isCategory(b.category)) return bad("دسته‌ی نامعتبر.");
    patch.category = b.category;
  }
  if (b.assigned_to !== undefined) {
    patch.assigned_to = b.assigned_to || null;
  }
  if (Object.keys(patch).length === 0) return ok();

  const { error } = await a.db.from("support_tickets").update(patch).eq("id", id);
  if (error) return bad(error.message, 500);

  await logAudit(a.db, {
    actor: a.username,
    action: "support_ticket_update",
    targetTable: "support_tickets",
    targetId: id,
    meta: patch,
    ip: clientIp(req),
  });
  return ok();
}

type ReplyBody = { body?: string; internal?: boolean };

/** POST — پاسخِ کارمندِ پشتیبانی. اگر internal=true باشد فقط داخلِ تیم دیده می‌شود. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await adminAuthed();
  if ("error" in a) return a.error;
  const { id } = await params;

  const b = (await req.json().catch(() => ({}))) as ReplyBody;
  const body = (b.body || "").trim();
  if (body.length < 1) return bad("متنِ پیام خالی است.");
  if (body.length > 5000) return bad("پیام بیش‌از‌حد طولانی است.");

  const isInternal = !!b.internal;

  const { error } = await a.db.from("support_messages").insert({
    ticket_id: id,
    author_type: isInternal ? "staff" : "staff",
    author_name: a.username,
    body,
    is_internal: isInternal,
  });
  if (error) return bad(error.message, 500);

  // پاسخِ عمومی → تیکت می‌رود به waiting_user؛ یادداشتِ داخلی وضعیت را عوض نمی‌کند.
  if (!isInternal) {
    await a.db
      .from("support_tickets")
      .update({ status: "waiting_user", assigned_to: a.username })
      .eq("id", id);
  }

  return ok();
}
