import { adminAuthed, ok, bad } from "@/lib/api";
import { getAllFlags, setFlag } from "@/lib/flags";
import { clientIp } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: همه‌ی فلگ‌ها / کلیدهای قطع. */
export async function GET() {
  const a = await adminAuthed();
  if ("error" in a) return a.error;
  return ok({ flags: await getAllFlags(a.db) });
}

/**
 * POST {key, enabled?, value?}: تنظیمِ یک فلگ. هر تغییر در ممیزی ثبت می‌شود.
 * value یک شیء (jsonb) است — مثلاً برای بودجه {"toman": 350000}.
 */
export async function POST(req: Request) {
  const a = await adminAuthed("manage_flags");
  if ("error" in a) return a.error;

  const b = await req.json().catch(() => ({}));
  const key = String(b?.key ?? "").trim();
  if (!key) return bad("کلیدِ فلگ لازم است.");

  const patch: { enabled?: boolean; value?: Record<string, unknown> | null } = {};
  if (typeof b.enabled === "boolean") patch.enabled = b.enabled;
  if (b.value !== undefined) patch.value = b.value;
  if (patch.enabled === undefined && patch.value === undefined) {
    return bad("چیزی برای تغییر نیست (enabled یا value لازم است).");
  }

  await setFlag(a.db, key, patch, a.username, clientIp(req));
  return ok({ flags: await getAllFlags(a.db) });
}
