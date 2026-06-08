import { NextResponse } from "next/server";
import { adminAuthed } from "@/lib/api";
import { ADMIN_TABLES } from "@/lib/adminTables";
import { logAudit, clientIp } from "@/lib/audit";

export const runtime = "nodejs";

/** GET: دامپِ JSON از همه‌ی جدول‌ها برای بک‌آپ (دانلود). */
export async function GET(req: Request) {
  const a = await adminAuthed("export_data");
  if ("error" in a) return a.error;

  // خروجیِ کاملِ دیتا حساس است — همیشه در ممیزی ثبت شود.
  await logAudit(a.db, { actor: a.username, action: "export", ip: clientIp(req) });

  const dump: Record<string, unknown[]> = {};
  for (const name of ADMIN_TABLES) {
    const { data, error } = await a.db.from(name).select("*");
    dump[name] = error ? [] : (data ?? []);
  }

  const body = JSON.stringify(
    { exported_at: new Date().toISOString(), tables: dump },
    null,
    2
  );
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="zendegi-backup-${stamp}.json"`,
    },
  });
}
