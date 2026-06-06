"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiGet, apiSend } from "@/lib/client";
import { fa, money, jDateShort } from "@/lib/format";
import { Card, Button, Spinner, SectionTitle } from "@/components/ui";
import { AppIcon } from "@/components/AppIcon";

type Pack = { id: string; toman: number; credits: number; label: string };
type LedgerRow = { delta: number; reason: string; balance_after: number; created_at: string };
type WalletData = {
  credits: number;
  freeUsedToday: number;
  freeDaily: number;
  packs: Pack[];
  ledger: LedgerRow[];
};

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
  const [banner, setBanner] = useState<{ kind: "success" | "failed"; text: string } | null>(null);

  const load = useCallback(async () => {
    const d = await apiGet<WalletData>("/api/billing/wallet");
    setData(d);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // نتیجه‌ی بازگشت از درگاهِ پرداخت
  useEffect(() => {
    const status = params.get("status");
    if (status === "success") {
      const c = params.get("credits");
      setBanner({ kind: "success", text: `پرداخت موفق بود${c ? ` — ${fa(Number(c))} اعتبار اضافه شد` : ""}. 🎉` });
    } else if (status === "failed") {
      setBanner({ kind: "failed", text: "پرداخت کامل نشد. اگر مبلغی کسر شده تا ۷۲ ساعت برمی‌گردد." });
    }
  }, [params]);

  async function buy(pack: Pack) {
    setBuying(pack.id);
    try {
      const { url } = await apiSend<{ url: string }>("/api/billing/checkout", "POST", { packId: pack.id });
      window.location.href = url;
    } catch (e) {
      setBanner({ kind: "failed", text: e instanceof Error ? e.message : "اتصال به درگاه ناموفق بود." });
      setBuying(null);
    }
  }

  if (loading || !data) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  const freeLeft = Math.max(0, data.freeDaily - data.freeUsedToday);

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

      {/* سهمیه‌ی رایگانِ امروز */}
      <Card className="mt-3 p-4 flex items-center gap-3">
        <AppIcon name="sparkles" size={22} className="text-ios-blue" />
        <p className="text-[15px]">
          امروز <b>{fa(freeLeft)}</b> از <b>{fa(data.freeDaily)}</b> فراخوانیِ رایگانِ هوش مصنوعی باقی مونده. بعدش از اعتبارت استفاده می‌شه.
        </p>
      </Card>

      <SectionTitle>شارژِ کیف پول</SectionTitle>
      <div className="space-y-3">
        {data.packs.map((p) => (
          <Card key={p.id} className="p-4 flex items-center gap-4">
            <div className="flex-1">
              <p className="text-[17px] font-bold">{fa(p.credits)} اعتبار</p>
              <p className="secondary text-[14px]">{p.label} — {money(p.toman)}</p>
            </div>
            <Button
              onClick={() => buy(p)}
              disabled={buying != null}
              className="flex items-center gap-2 px-5"
            >
              {buying === p.id ? <Spinner /> : "خرید"}
            </Button>
          </Card>
        ))}
      </div>

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
