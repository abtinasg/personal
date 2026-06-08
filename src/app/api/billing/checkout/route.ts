import { authed, bad, ok } from "@/lib/api";
import { findPack, parsePackId } from "@/lib/billing";
import { requestPayment } from "@/lib/zibal";
import { logEvent } from "@/lib/events";
import { isEnabled } from "@/lib/flags";

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
  if ("error" in a) {
    console.error("Checkout auth failed");
    return a.error;
  }

  // کلیدِ قطعِ پرداخت (و maintenance_mode)
  if (!(await isEnabled(a.db, "payments_enabled"))) {
    return bad("پرداخت موقتاً غیرفعاله؛ کمی بعد دوباره امتحان کن.", 503);
  }

  const body = await req.json().catch(() => ({}));
  const pack = findPack(String(body?.packId ?? ""));
  if (!pack) {
    console.error("Checkout invalid pack", { packId: body?.packId });
    return bad("بسته‌ی نامعتبر.");
  }

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
  if (insErr || !payment) {
    console.error("Checkout DB insert failed", { error: insErr?.message || "unknown" });
    return bad("ثبتِ پرداخت ناموفق بود. دوباره تلاش کن.", 500);
  }

  try {
    const { authority, payUrl } = await requestPayment({
      amount: pack.toman,
      description: `شارژِ ${pack.credits} اعتبارِ هوش مصنوعی — ${pack.label}`,
      callbackUrl: `${baseUrl(req)}/api/billing/callback`,
    });
    await a.db.from("payments").update({ authority }).eq("id", payment.id);
    await logEvent(a.db, "checkout_start", {
      userId: a.uid,
      props: { packId: pack.id, amount: pack.toman, plan: parsed?.plan ?? null },
    });
    return ok({ url: payUrl });
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "اتصال به درگاهِ پرداخت ناموفق بود.";
    console.error("Checkout Zibal error:", { error: errorMsg, packId: pack.id, userId: a.uid });
    await a.db.from("payments").update({ status: "failed" }).eq("id", payment.id);
    return bad(errorMsg, 502);
  }
}
