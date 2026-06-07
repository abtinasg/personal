import { authed, ok, bad } from "@/lib/api";
import { findPack, parsePackId } from "@/lib/billing";
import { requestPayment } from "@/lib/zibal";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const steps: Record<string, any> = {};

  try {
    // Step 1: تست هویت‌شناسی
    steps.auth = { status: "testing" };
    const a = await authed();
    if ("error" in a) {
      steps.auth = { status: "failed", error: "ورود ناموفق بود" };
      return ok({ steps });
    }
    steps.auth = { status: "ok", userId: a.uid };

    // Step 2: پیدا کردنِ بسته‌ی پرداخت
    steps.pack = { status: "testing" };
    const body = await req.json().catch(() => ({}));
    const pack = findPack(String(body?.packId ?? ""));
    if (!pack) {
      steps.pack = { status: "failed", error: "بسته نادرست", packId: body?.packId };
      return ok({ steps });
    }
    steps.pack = { status: "ok", pack: { id: pack.id, toman: pack.toman, credits: pack.credits } };

    // Step 3: تست درج در دیتابیس
    steps.dbInsert = { status: "testing" };
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
      steps.dbInsert = { status: "failed", error: insErr?.message || "درج ناموفق" };
      return ok({ steps });
    }
    steps.dbInsert = { status: "ok", paymentId: payment.id };

    // Step 4: تست درخواستِ پرداخت به زیبال
    steps.zibalRequest = { status: "testing" };
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${new URL(req.url).protocol}//${new URL(req.url).host}`;
    const callbackUrl = `${baseUrl}/api/billing/callback`;

    const { authority, payUrl } = await requestPayment({
      amount: pack.toman,
      description: `تستِ پرداخت — ${pack.label}`,
      callbackUrl,
    });

    steps.zibalRequest = { status: "ok", authority, callbackUrl };

    // Step 5: ذخیرهٔ authority
    steps.dbUpdate = { status: "testing" };
    const { error: updateErr } = await a.db
      .from("payments")
      .update({ authority })
      .eq("id", payment.id);

    if (updateErr) {
      steps.dbUpdate = { status: "failed", error: updateErr.message };
      return ok({ steps });
    }
    steps.dbUpdate = { status: "ok" };

    return ok({ steps, success: true, payUrl });
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error("Diagnose error:", errorMsg);
    return ok({ steps, error: errorMsg });
  }
}
