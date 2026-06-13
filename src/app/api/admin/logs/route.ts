import { adminAuthed, ok, bad } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?limit=&scope=&level= : آخرین لاگ‌های اپ (جدیدترین اول) — تبِ «لاگ‌ها»ی پنل. */
export async function GET(req: Request) {
  const a = await adminAuthed();
  if ("error" in a) return a.error;

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 100, 500);
  const scope = url.searchParams.get("scope") || "";
  const level = url.searchParams.get("level") || "";

  let q = a.db.from("app_logs").select("*");
  if (scope) q = q.eq("scope", scope);
  if (level) q = q.eq("level", level);

  const { data, error } = await q.order("created_at", { ascending: false }).limit(limit);
  if (error) return bad(error.message, 500);
  return ok({ logs: data ?? [] });
}
