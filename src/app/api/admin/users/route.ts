import { adminAuthed, ok, bad } from "@/lib/api";

export const runtime = "nodejs";

/** GET: لیست کاربران + شمارِ پسکی‌های هر کدام. */
export async function GET() {
  const a = await adminAuthed();
  if ("error" in a) return a.error;

  const { data: users, error } = await a.db
    .from("users")
    .select("id, username, display_name, created_at")
    .order("created_at", { ascending: false });
  if (error) return bad(error.message, 500);

  const withCreds = await Promise.all(
    (users ?? []).map(async (u) => {
      const { count } = await a.db
        .from("credentials")
        .select("*", { count: "exact", head: true })
        .eq("user_id", u.id);
      return { ...u, passkeys: count ?? 0 };
    })
  );

  return ok({ users: withCreds });
}

/** DELETE ?id= : حذف کاربر (cascade دیتا و پسکی‌ها). ادمین نمی‌تواند خودش را حذف کند. */
export async function DELETE(req: Request) {
  const a = await adminAuthed();
  if ("error" in a) return a.error;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return bad("شناسه لازم است.");
  if (id === a.uid) return bad("نمی‌توانی حساب خودت را حذف کنی.");

  const { error } = await a.db.from("users").delete().eq("id", id);
  if (error) return bad(error.message, 500);
  return ok();
}
