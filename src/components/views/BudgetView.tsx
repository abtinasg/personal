"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiSend } from "@/lib/client";
import { fa, money, todayISO, monthKey, monthStart, monthLabel } from "@/lib/format";
import type { Profile, Transaction } from "@/lib/types";
import { Card, Ring, Sheet, Field, Button, Spinner, EmptyState, Segmented, SectionTitle } from "@/components/ui";
import { AddButton } from "@/components/views/CaloriesView";
import { AppIcon } from "@/components/AppIcon";

const EXPENSE_CATS = ["خوراک", "حمل‌ونقل", "خرید", "قبوض", "تفریح", "سلامت", "سایر"];
const INCOME_CATS = ["حقوق", "فریلنس", "هدیه", "سایر"];
const CAT_ICON: Record<string, string> = {
  خوراک: "food", "حمل‌ونقل": "transport", خرید: "shopping", قبوض: "bills", تفریح: "fun",
  سلامت: "health", حقوق: "salary", فریلنس: "freelance", هدیه: "gift", سایر: "other",
};

export default function BudgetView({ profile }: { profile: Profile | null }) {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const mk = monthKey();
  const currency = profile?.currency || "تومان";

  const load = useCallback(async () => {
    const { transactions } = await apiGet<{ transactions: Transaction[] }>(
      `/api/transactions?from=${monthStart(mk)}`
    );
    setTxs(transactions.filter((t) => t.occurred_on.startsWith(mk)));
    setLoading(false);
  }, [mk]);

  useEffect(() => {
    load();
  }, [load]);

  const { income, expense, byCat } = useMemo(() => {
    let income = 0, expense = 0;
    const byCat: Record<string, number> = {};
    for (const t of txs) {
      if (t.kind === "income") income += Number(t.amount);
      else {
        expense += Number(t.amount);
        byCat[t.category] = (byCat[t.category] || 0) + Number(t.amount);
      }
    }
    return { income, expense, byCat };
  }, [txs]);

  const budget = profile?.monthly_budget || 0;
  const balance = income - expense;
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

  async function remove(id: string) {
    setTxs((t) => t.filter((x) => x.id !== id));
    await apiSend(`/api/transactions?id=${id}`, "DELETE");
  }

  return (
    <div className="space-y-3">
      <SectionTitle action={<AddButton onClick={() => setOpen(true)} />}>بودجه — {monthLabel(mk)}</SectionTitle>

      <Card className="flex items-center gap-5">
        {budget > 0 ? (
          <Ring progress={expense / budget} color={expense > budget ? "#f56178" : "#5b76f0"} size={132} stroke={14}>
            <span className="text-[22px] font-extrabold leading-none">{fa(Math.round((expense / budget) * 100))}٪</span>
            <span className="secondary text-[12px] mt-1">از بودجه</span>
          </Ring>
        ) : (
          <Ring progress={0.0001} color="#5b76f0" size={132} stroke={14}>
            <span className="text-ios-blue"><AppIcon name="wallet" size={24} /></span>
          </Ring>
        )}
        <div className="flex-1 space-y-2.5">
          <Row label="مانده" value={money(balance, currency)} tone={balance < 0 ? "red" : "green"} />
          <Row label="درآمد" value={money(income, currency)} small />
          <Row label="هزینه" value={money(expense, currency)} small />
          {budget > 0 && (
            <Row
              label="باقی‌مانده‌ی بودجه"
              value={money(budget - expense, currency)}
              small
              tone={budget - expense < 0 ? "red" : undefined}
            />
          )}
        </div>
      </Card>

      {cats.length > 0 && (
        <Card>
          <p className="font-bold mb-3">هزینه به تفکیک دسته</p>
          <div className="space-y-2.5">
            {cats.map(([cat, amt]) => {
              const pct = expense ? (amt / expense) * 100 : 0;
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between text-[14px] mb-1">
                    <span className="flex items-center gap-1.5"><AppIcon name={CAT_ICON[cat] || "other"} size={16} /> {cat}</span>
                    <span className="secondary">{money(amt, currency)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
                    <div className="h-full rounded-full bg-ios-blue" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {loading ? (
        <Card className="flex justify-center py-8"><Spinner /></Card>
      ) : txs.length === 0 ? (
        <Card><EmptyState icon="expense" title="هنوز تراکنشی نداری" sub="درآمد یا هزینه‌ت رو با + ثبت کن" /></Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          {txs.map((t) => (
            <div key={t.id} className="hairline flex items-center gap-3 px-4 py-3">
              <span className="text-ios-blue shrink-0"><AppIcon name={CAT_ICON[t.category] || "other"} size={22} /></span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{t.note || t.category}</p>
                <p className="secondary text-[13px]">{t.category}</p>
              </div>
              <span className={`font-bold whitespace-nowrap ${t.kind === "income" ? "text-ios-green" : "text-ios-red"}`}>
                {t.kind === "income" ? "+" : "−"}{fa(Number(t.amount))}
              </span>
              <button onClick={() => remove(t.id)} className="text-ios-red/70 active:opacity-50 text-[20px] leading-none px-1">×</button>
            </div>
          ))}
        </Card>
      )}

      <AddTxSheet open={open} onClose={() => setOpen(false)} onAdded={load} />
    </div>
  );
}

function AddTxSheet({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: () => void }) {
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("خوراک");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const cats = kind === "expense" ? EXPENSE_CATS : INCOME_CATS;

  async function submit() {
    if (!amount) return;
    setBusy(true);
    try {
      await apiSend("/api/transactions", "POST", { kind, amount: Number(amount), category, note, date: todayISO() });
      setAmount(""); setNote("");
      onAdded();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="ثبت تراکنش">
      <div className="space-y-3">
        <Segmented
          value={kind}
          onChange={(k) => { setKind(k); setCategory(k === "expense" ? "خوراک" : "حقوق"); }}
          options={[{ value: "expense", label: "هزینه" }, { value: "income", label: "درآمد" }]}
        />
        <Field label="مبلغ">
          <input className="ios-input text-center text-[22px] font-bold" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="۰" />
        </Field>
        <Field label="دسته">
          <div className="flex flex-wrap gap-2">
            {cats.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3 py-2 rounded-full text-[14px] font-medium transition inline-flex items-center gap-1.5 ${
                  category === c ? "bg-ios-blue text-white" : "bg-black/[0.05] dark:bg-white/[0.08]"
                }`}
              >
                <AppIcon name={CAT_ICON[c] || "other"} size={15} /> {c}
              </button>
            ))}
          </div>
        </Field>
        <Field label="توضیح (اختیاری)">
          <input className="ios-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثلاً ناهار بیرون" />
        </Field>
        <Button onClick={submit} disabled={busy || !amount} className="w-full flex items-center justify-center gap-2 mt-1">
          {busy && <Spinner />} ثبت
        </Button>
      </div>
    </Sheet>
  );
}

function Row({ label, value, small, tone }: { label: string; value: string; small?: boolean; tone?: "red" | "green" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="secondary text-[13px]">{label}</span>
      <span className={`font-bold ${small ? "text-[15px]" : "text-[19px]"} ${tone === "red" ? "text-ios-red" : tone === "green" ? "text-ios-green" : ""}`}>
        {value}
      </span>
    </div>
  );
}
