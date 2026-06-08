import { adminAuthed, ok, bad } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?limit= : آخرین رکوردهای گزارشِ ممیزی (جدیدترین اول). */
export async function GET(req: Request) {
  const a = await adminAuthed();
  if ("error" in a) return a.error;

  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit")) || 100, 500);
  const { data, error } = await a.db
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return bad(error.message, 500);
  return ok({ entries: data ?? [] });
}
