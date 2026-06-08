import { authed, ok, bad } from "@/lib/api";
import {
  isCategory,
  priorityForCategory,
  type TicketCategory,
} from "@/lib/support";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — لیستِ تیکت‌های همین کاربر (جدیدترین اول). */
export async function GET() {
  const a = await authed();
  if ("error" in a) return a.error;

  const { data, error } = await a.db
    .from("support_tickets")
    .select("id, subject, category, priority, status, created_at, updated_at")
    .eq("user_id", a.uid)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return bad(error.message, 500);
  return ok({ tickets: data ?? [] });
}

type CreateBody = {
  subject?: string;
  body?: string;
  category?: string;
  contact?: string;
  meta?: Record<string, unknown>;
};

/** POST — ساختِ تیکتِ جدید. اولویت از روی دسته‌بندی خودکار حساب می‌شود. */
export async function POST(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;

  const b = (await req.json().catch(() => ({}))) as CreateBody;
  const subject = (b.subject || "").trim();
  const body = (b.body || "").trim();
  if (subject.length < 3) return bad("موضوع باید حداقل ۳ کاراکتر باشد.");
  if (body.length < 5) return bad("توضیحات باید حداقل ۵ کاراکتر باشد.");
  if (subject.length > 200) return bad("موضوع طولانی است.");
  if (body.length > 5000) return bad("توضیحات بیش‌از‌حد طولانی است.");

  const category: TicketCategory = isCategory(b.category) ? b.category : "general";
  const priority = priorityForCategory(category);

  // یوزرنیمِ کاربر را برای نمایش در پیامِ اول ذخیره می‌کنیم تا در صفحه‌ی ادمین
  // بدونِ join بشود نشان داد.
  const { data: u } = await a.db
    .from("users")
    .select("display_name, username, phone")
    .eq("id", a.uid)
    .maybeSingle();
  const authorName = (u?.display_name as string) || (u?.username as string) || "کاربر";
  const contact = (b.contact || (u?.phone as string) || "").trim() || null;

  const { data: ticket, error } = await a.db
    .from("support_tickets")
    .insert({
      user_id: a.uid,
      contact,
      category,
      priority,
      status: "new",
      subject,
      body,
      meta: b.meta ? JSON.stringify(b.meta) : undefined,
    })
    .select("id")
    .single();
  if (error || !ticket) return bad(error?.message || "ثبت تیکت ناموفق بود.", 500);

  // اولین پیام = خودِ متنِ تیکت — تا صفحه‌ی گفتگو یک‌دست بماند.
  await a.db.from("support_messages").insert({
    ticket_id: (ticket as { id: string }).id,
    author_type: "user",
    author_name: authorName,
    body,
  });

  return ok({ id: (ticket as { id: string }).id });
}
