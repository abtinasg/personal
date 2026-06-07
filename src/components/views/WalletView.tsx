"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiGet, apiSend } from "@/lib/client";
import { fa, money, jDateShort } from "@/lib/format";
import { PLANS, annualPrice, type BillingCycle, type Plan } from "@/lib/billing";
import { Card, Button, Spinner, SectionTitle } from "@/components/ui";
import { AppIcon } from "@/components/AppIcon";

type LedgerRow = { delta: number; reason: string; balance_after: number; created_at: string };
type WalletData = {
  credits: number;
  freeUsedToday: number;
  freeDaily: number;
  plan: { plan: string; cycle: string; expiresAt: string } | null;
  ledger: LedgerRow[];
};

const planName = (id?: string | null) => PLANS.find((p) => p.id === id)?.name ?? "";

// برچسبِ فارسیِ دلیلِ هر تراکنش در دفترِ کل
const REASON_LABEL: Record<string, string> = {
  purchase: "شارژِ کیف پول",
  coach_chat: "گفتگو با مربی",
  coach_briefing: "خلاصه‌ی روزانه",
  coach_invest: "مشاور سرمایه‌گذاری",
  coach_parse: "ثبتِ هوشمند",
  coach_nutrition: "برنامه‌ی تغذیه",
  coach_workout: "برنامه‌ی تمرین",
  coach_weekly: "مرور هفتگی",
  meal_estimate: "تخمینِ کالری",
  meal_report: "تحلیلِ وعده‌ها",
  mission_generate: "ساختِ ماموریت",
};

function reasonLabel(r: string): string {
  return REASON_LABEL[r] ?? r;
}

export default function WalletView() {
  const params = useSearchParams();
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [banner, setBanner] = useState<{ kind: "success" | "failed"; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await apiGet<WalletData>("/api/billing/wallet");
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در دریافتِ اطلاعاتِ کیف پول.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // نتیجه‌ی بازگشت از درگاهِ پرداخت
  useEffect(() => {
    const status = params.get("status");
    if (status === "success") {
      const p = params.get("plan");
      const c = params.get("credits");
      const text = p
        ? `پلنِ ${planName(p) || "اشتراک"} فعال شد. خوش اومدی! 🎉`
        : `پرداخت موفق بود${c ? ` — ${fa(Number(c))} اعتبار اضافه شد` : ""}. 🎉`;
      setBanner({ kind: "success", text });
    } else if (status === "failed") {
      setBanner({ kind: "failed", text: "پرداخت کامل نشد. اگر مبلغی کسر شده تا ۷۲ ساعت برمی‌گردد." });
    }
  }, [params]);

  // خریدِ پلن: پلن + دوره را به شناسه‌ی بسته‌ی پرداخت نگاشت می‌کند.
  async function buy(plan: Plan) {
    const packId = `${plan.id}-${cycle}`;
    setBuying(packId);
    try {
      const { url } = await apiSend<{ url: string }>("/api/billing/checkout", "POST", { packId });
      window.location.href = url;
    } catch (e) {
      setBanner({ kind: "failed", text: e instanceof Error ? e.message : "اتصال به درگاه ناموفق بود." });
      setBuying(null);
    }
  }

  if (error) return <div className="p-6 text-center text-ios-red">{error}</div>;

  if (loading || !data) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  const freeLeft = Math.max(0, data.freeDaily - data.freeUsedToday);
  const activePlanId = data.plan?.plan ?? "free";

  return (
    <div className="pb-8">
      {banner && (
        <Card className={`mb-4 p-4 text-[15px] font-semibold ${banner.kind === "success" ? "text-ios-green" : "text-ios-red"}`}>
          {banner.text}
        </Card>
      )}

      {/* موجودیِ اعتبار */}
      <Card className="p-5 flex items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-gradient-to-br from-[var(--blue)] to-[var(--lav)] text-white flex items-center justify-center shrink-0">
          <AppIcon name="wallet" size={28} className="text-white" />
        </div>
        <div className="flex-1">
          <p className="secondary text-[14px]">موجودیِ اعتبار</p>
          <p className="text-[28px] font-extrabold leading-tight">{fa(data.credits)} <span className="text-[16px] font-bold secondary">اعتبار</span></p>
        </div>
      </Card>

      {/* وضعیتِ پلن یا سهمیه‌ی رایگانِ امروز */}
      {data.plan ? (
        <Card className="mt-3 p-4 flex items-center gap-3">
          <AppIcon name="sprout" size={22} className="text-ios-green" />
          <p className="text-[15px]">
            پلنِ <b>{planName(data.plan.plan) || "اشتراک"}</b> فعاله — تا <b>{jDateShort(data.plan.expiresAt)}</b>. گفتگو با جوانه نامحدوده. 🌱
          </p>
        </Card>
      ) : (
        <Card className="mt-3 p-4 flex items-center gap-3">
          <AppIcon name="sparkles" size={22} className="text-ios-blue" />
          <p className="text-[15px]">
            امروز <b>{fa(freeLeft)}</b> از <b>{fa(data.freeDaily)}</b> گفتگوی رایگان با جوانه باقی مونده. بعدش با پلاس ادامه بده.
          </p>
        </Card>
      )}

      {/* ----- پلن‌ها ----- */}
      <div className="mt-7 mb-4 text-center">
        <h2 className="text-[22px] font-extrabold tracking-tight">مربی‌ت رو کامل کن</h2>
        <p className="secondary text-[14px] mt-1.5 px-3 leading-relaxed">
          ثبتِ کالری، بودجه و عادت همیشه رایگانه. این پلن‌ها هوشِ جوانه رو باز می‌کنن.
        </p>
      </div>

      {/* کلیدِ ماهانه / سالانه */}
      <div className="flex items-center justify-center mb-4">
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-black/[0.05] dark:bg-white/[0.08]">
          {(["monthly", "annual"] as BillingCycle[]).map((c) => (
            <button
              key={c}
              onClick={() => setCycle(c)}
              className={`px-4 py-1.5 rounded-full text-[14px] font-bold transition flex items-center gap-1.5 ${
                cycle === c ? "bg-[var(--card-solid)] shadow-soft text-[var(--label)]" : "secondary"
              }`}
            >
              {c === "monthly" ? "ماهانه" : "سالانه"}
              {c === "annual" && (
                <span className="text-ios-green text-[11px] font-extrabold">۲ ماه هدیه</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {PLANS.map((plan) => {
          const isFree = plan.priceMonthly === 0;
          const isCurrent = plan.id === activePlanId;
          const price = cycle === "annual" ? annualPrice(plan.priceMonthly) : plan.priceMonthly;
          const packId = `${plan.id}-${cycle}`;
          return (
            <Card
              key={plan.id}
              className={`relative p-5 ${plan.highlight ? "ring-2 ring-ios-blue" : ""}`}
            >
              {isCurrent ? (
                <span className="absolute -top-3 right-5 rounded-full bg-ios-green text-white text-[12px] font-extrabold px-3 py-1 shadow-soft">
                  فعال
                </span>
              ) : plan.highlight ? (
                <span className="absolute -top-3 right-5 rounded-full bg-ios-blue text-white text-[12px] font-extrabold px-3 py-1 shadow-soft">
                  پیشنهاد ما
                </span>
              ) : null}

              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[19px] font-extrabold">{plan.name}</p>
                {isFree ? (
                  <p className="text-[17px] font-extrabold secondary">رایگان</p>
                ) : (
                  <p className="font-extrabold leading-none">
                    <span className="text-[20px]">{money(price)}</span>
                    <span className="secondary text-[13px] font-bold"> /{cycle === "annual" ? "سال" : "ماه"}</span>
                  </p>
                )}
              </div>
              <p className="secondary text-[14px] mt-1">{plan.tagline}</p>

              <ul className="mt-4 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[14.5px] leading-6">
                    <span className="text-ios-green mt-0.5 shrink-0">
                      <CheckIcon />
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {isFree ? (
                <div className="mt-4 text-center text-[14px] font-bold secondary py-3 rounded-full bg-black/[0.04] dark:bg-white/[0.06]">
                  {isCurrent ? "پلنِ فعلیِ تو" : "پایه — همیشه در دسترس"}
                </div>
              ) : (
                <Button
                  onClick={() => buy(plan)}
                  disabled={buying != null}
                  className="w-full mt-4"
                >
                  {buying === packId ? <Spinner /> : isCurrent ? `تمدیدِ ${plan.name}` : `شروع ${plan.name}`}
                </Button>
              )}
            </Card>
          );
        })}
      </div>

      <p className="secondary text-[12.5px] text-center mt-4 leading-relaxed px-5">
        اول رایگان امتحان کن، بعد تصمیم بگیر. هر وقت خواستی لغو کن، بی‌دردسر.
      </p>

      {data.ledger.length > 0 && (
        <>
          <SectionTitle>تاریخچه</SectionTitle>
          <Card className="divide-y divide-[var(--label)]/[0.06]">
            {data.ledger.map((row, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-[15px] font-semibold">{reasonLabel(row.reason)}</p>
                  <p className="secondary text-[13px]">{jDateShort(row.created_at)}</p>
                </div>
                <p className={`text-[16px] font-bold ${row.delta > 0 ? "text-ios-green" : "secondary"}`} dir="ltr">
                  {row.delta > 0 ? "+" : ""}{fa(row.delta)}
                </p>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
