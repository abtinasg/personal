import { authed, ok, bad } from "@/lib/api";
import { guardAI } from "@/lib/aiGuard";
import { captureFromText } from "@/lib/capture";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const guard = await guardAI(a.db, a.uid, "coach_parse");
  if ("error" in guard) return guard.error;
  const b = await req.json().catch(() => ({}));

  const text = String(b.text || "").trim();
  if (!text) return bad("یه چیزی بنویس تا ثبتش کنم.");

  const { saved, note, errors } = await captureFromText(a.db, a.uid, text);

  if (!saved.length) {
    if (errors.length) return bad(errors[0], 502);
    return ok({ saved: [], note: note || "چیزی برای ثبت پیدا نکردم. می‌تونی واضح‌تر بنویسی؟" });
  }

  return ok({ saved, note });
}
