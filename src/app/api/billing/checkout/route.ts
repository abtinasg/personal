import { authed, bad, ok } from "@/lib/api";
import { findPack, parsePackId } from "@/lib/billing";
import { requestPayment } from "@/lib/zibal";

export const runtime = "nodejs";

function baseUrl(req: Request): string {
  const env = process.env.NEXT_PUBLIC_BASE_URL;
  if (env) return env.replace(/\/$/, "");
  // fallback: از خودِ درخواست بساز (محلی)
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;

  const body = await req.json().catch(() => ({}));
  const pack = findPack(String(body?.packId ?? ""));
  if (!pack) return bad("بسته‌ی نامعتبر.");

  // ردیفِ پرداختِ در حالِ انتظار (پلن/دوره را هم نگه می‌داریم تا callback فعالش کند)
  const parsed = parsePackId(pack.id);
  const { data: payment, error: insErr } = await a.db
    .from("payments")
    .insert({
      user_id: a.uid,
      amount: pack.toman,
      credits: pack.credits,
      status: "pending",
      plan: parsed?.plan ?? null,
      cycle: parsed?.cycle ?? null,
    })
    .select("id")
    .single();
  if (insErr || !payment) return bad("ثبتِ پرداخت ناموفق بود.", 500);

  try {
    const { authority, payUrl } = await requestPayment({
      amount: pack.toman,
      description: `شارژِ ${pack.credits} اعتبارِ هوش مصنوعی — ${pack.label}`,
      callbackUrl: `${baseUrl(req)}/api/billing/callback`,
    });
    await a.db.from("payments").update({ authority }).eq("id", payment.id);
    return ok({ url: payUrl });
  } catch (e) {
    await a.db.from("payments").update({ status: "failed" }).eq("id", payment.id);
    return bad(e instanceof Error ? e.message : "اتصال به درگاهِ پرداخت ناموفق بود.", 502);
  }
}
