import { adminAuthed, ok, bad } from "@/lib/api";
import { isAdminTable, TABLE_ORDER_COLUMN } from "@/lib/adminTables";

export const runtime = "nodejs";

/** GET ?name=&limit=&offset= : ردیف‌های یک جدولِ مجاز (جدیدترین اول). */
export async function GET(req: Request) {
  const a = await adminAuthed();
  if ("error" in a) return a.error;

  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name");
  if (!isAdminTable(name)) return bad("نام جدول مجاز نیست.");

  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);
  const orderCol = TABLE_ORDER_COLUMN[name] ?? "created_at";

  const { data, count, error } = await a.db
    .from(name)
    .select("*", { count: "exact" })
    .order(orderCol, { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return bad(error.message, 500);
  return ok({ rows: data, total: count ?? 0, limit, offset });
}

/** PATCH {name, id, patch}: ویرایش یک ردیف. */
export async function PATCH(req: Request) {
  const a = await adminAuthed();
  if ("error" in a) return a.error;

  const b = await req.json().catch(() => ({}));
  const name = b.name as string | null;
  const id = b.id;
  if (!isAdminTable(name)) return bad("نام جدول مجاز نیست.");
  if (!id) return bad("شناسه لازم است.");
  if (!b.patch || typeof b.patch !== "object") return bad("داده‌ی ویرایش لازم است.");

  // شناسه و کلیدها قابل تغییر نیستند
  const patch = { ...b.patch };
  delete patch.id;

  const { data, error } = await a.db.from(name).update(patch).eq("id", id).select().single();
  if (error) return bad(error.message, 500);
  return ok({ row: data });
}

/** DELETE ?name=&id= : حذف یک ردیف. */
export async function DELETE(req: Request) {
  const a = await adminAuthed();
  if ("error" in a) return a.error;

  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name");
  const id = searchParams.get("id");
  if (!isAdminTable(name)) return bad("نام جدول مجاز نیست.");
  if (!id) return bad("شناسه لازم است.");

  const { error } = await a.db.from(name).delete().eq("id", id);
  if (error) return bad(error.message, 500);
  return ok();
}
