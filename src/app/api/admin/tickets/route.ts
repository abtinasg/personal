import { adminAuthed, ok, bad } from "@/lib/api";
import { isCategory, isPriority, isStatus } from "@/lib/support";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET — لیستِ تیکت‌ها برای پنلِ پشتیبانی. فیلترهای اختیاری:
 *   ?status=new,open  ?priority=p0,p1  ?category=payment  ?assignee=<username>
 *   ?q=<جست‌وجو در subject>  ?limit=50
 */
export async function GET(req: Request) {
  const a = await adminAuthed();
  if ("error" in a) return a.error;

  const url = new URL(req.url);
  const statusCsv = url.searchParams.get("status");
  const priorityCsv = url.searchParams.get("priority");
  const category = url.searchParams.get("category");
  const assignee = url.searchParams.get("assignee");
  const q = (url.searchParams.get("q") || "").trim();
  const limit = Math.min(Number(url.searchParams.get("limit") || 100), 500);

  const where: string[] = [];
  const params: unknown[] = [];
  const push = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };

  if (statusCsv) {
    const arr = statusCsv.split(",").filter(isStatus);
    if (arr.length) where.push(`status IN (${arr.map(push).join(",")})`);
  }
  if (priorityCsv) {
    const arr = priorityCsv.split(",").filter(isPriority);
    if (arr.length) where.push(`priority IN (${arr.map(push).join(",")})`);
  }
  if (category && isCategory(category)) where.push(`category = ${push(category)}`);
  if (assignee) where.push(`assigned_to = ${push(assignee)}`);
  if (q) where.push(`subject ILIKE ${push("%" + q + "%")}`);

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = await a.db.query<{
    id: string;
    subject: string;
    category: string;
    priority: string;
    status: string;
    assigned_to: string | null;
    created_at: string;
    updated_at: string;
    user_id: string | null;
    contact: string | null;
    display_name: string | null;
    username: string | null;
    msg_count: number;
  }>(
    `SELECT t.id, t.subject, t.category, t.priority, t.status, t.assigned_to,
            t.created_at, t.updated_at, t.user_id, t.contact,
            u.display_name, u.username,
            (SELECT COUNT(*) FROM support_messages m WHERE m.ticket_id = t.id) AS msg_count
       FROM support_tickets t
       LEFT JOIN users u ON u.id = t.user_id
       ${whereSql}
       ORDER BY
         CASE t.priority WHEN 'p0' THEN 0 WHEN 'p1' THEN 1 WHEN 'p2' THEN 2 ELSE 3 END,
         t.created_at DESC
       LIMIT ${limit}`,
    params
  );

  // شمارش‌های خلاصه برای نوارِ بالای داشبورد
  const stats = await a.db.query<{ status: string; n: number }>(
    `SELECT status, COUNT(*)::int AS n FROM support_tickets GROUP BY status`
  );

  return ok({ tickets: rows, stats });
}
