import { adminAuthed, ok } from "@/lib/api";
import { ADMIN_TABLES } from "@/lib/adminTables";

export const runtime = "nodejs";

/** GET: تعداد رکوردِ هر جدولِ مجاز. */
export async function GET() {
  const a = await adminAuthed();
  if ("error" in a) return a.error;

  const counts = await Promise.all(
    ADMIN_TABLES.map(async (name) => {
      const { count, error } = await a.db
        .from(name)
        .select("*", { count: "exact", head: true });
      return { name, count: error ? null : (count ?? 0) };
    })
  );

  return ok({ tables: counts });
}
