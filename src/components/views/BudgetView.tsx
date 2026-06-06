"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiSend } from "@/lib/client";
import { fa, faShort, money, parseNum, todayISO, monthKey, monthStart, monthLabel } from "@/lib/format";
import type { Profile, Transaction, PurchaseGoal, MarketRates, GoalDenom } from "@/lib/types";
import { Card, Sheet, Field, MoneyInput, Button, Spinner, EmptyState, Segmented, SectionTitle } from "@/components/ui";
import { AddButton } from "@/components/views/CaloriesView";
import { AppIcon } from "@/components/AppIcon";
import InvestChat from "@/components/InvestChat";

const EXPENSE_CATS = ["خوراک", "حمل‌ونقل", "خرید", "قبوض", "تفریح", "سلامت", "سایر"];
const INCOME_CATS = ["حقوق", "فریلنس", "هدیه", "سایر"];
const CAT_ICON: Record<string, string> = {
  خوراک: "food", "حمل‌ونقل": "transport", خرید: "shopping", قبوض: "bills", تفریح: "fun",
  سلامت: "health", حقوق: "salary", فریلنس: "freelance", هدیه: "gift", سایر: "other",
};

const DENOM: Record<GoalDenom, { label: string; unit: string; icon: string; rateKey: keyof MarketRates | null; antiInflation: boolean }> = {
  toman: { label: "تومان", unit: "تومان", icon: "wallet", rateKey: null, antiInflation: false },
  usd: { label: "دلار", unit: "دلار", icon: "dollar", rateKey: "usd", antiInflation: true },
  gold: { label: "طلای ۱۸", unit: "گرم", icon: "gold", rateKey: "gold", antiInflation: true },
  coin: { label: "سکه‌ی امامی", unit: "سکه", icon: "coin", rateKey: "coin", antiInflation: true },
};
const GOAL_ICONS = ["target", "phone", "transport", "estate", "study", "gift", "rocket", "gem"];

/** قیمتِ هدف بر حسبِ تومان با نرخِ امروز (یا null اگر نرخ نداریم). */
function tomanTarget(g: PurchaseGoal, r: MarketRates | null): number | null {
  if (g.denom === "toman") return Number(g.target_native);
  const key = DENOM[g.denom].rateKey;
  const rate = r && key ? (r[key] as number | null) : null;
  return rate ? Number(g.target_native) * rate : null;
}

export default function BudgetView({ profile }: { profile: Profile | null }) {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<PurchaseGoal[]>([]);
  const [rates, setRates] = useState<MarketRates | null>(null);
  const [loading, setLoading] = useState(true);
  const [openTx, setOpenTx] = useState(false);
  const [openGoal, setOpenGoal] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [saveGoal, setSaveGoal] = useState<PurchaseGoal | null>(null);
  const mk = monthKey();
  const currency = profile?.currency || "تومان";

  const load = useCallback(async () => {
    const [txR, gR] = await Promise.all([
      apiGet<{ transactions: Transaction[] }>(`/api/transactions?from=${monthStart(mk)}`),
      apiGet<{ goals: PurchaseGoal[] }>(`/api/goals`),
    ]);
    setTxs(txR.transactions.filter((t) => t.occurred_on.startsWith(mk)));
    setGoals(gR.goals);
    setLoading(false);
  }, [mk]);

  useEffect(() => {
    load();
    apiGet<{ rates: MarketRates }>(`/api/market`).then((r) => setRates(r.rates)).catch(() => {});
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

  const surplus = income - expense;
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const activeGoals = goals.filter((g) => g.status !== "archived");

  async function removeTx(id: string) {
    setTxs((t) => t.filter((x) => x.id !== id));
    await apiSend(`/api/transactions?id=${id}`, "DELETE");
  }

  return (
    <div className="space-y-3">
      <SectionTitle action={<AddButton onClick={() => setOpenTx(true)} />}>سرمایه — {monthLabel(mk)}</SectionTitle>

      {/* سرمایه‌ی قابلِ سرمایه‌گذاری این ماه */}
      <Card>
        <div className="flex items-center justify-between mb-1">
          <span className="secondary text-[13px]">مازادِ این ماه — سرمایه‌ی قابلِ سرمایه‌گذاری</span>
          <span className="text-ios-green"><AppIcon name="invest" size={18} /></span>
        </div>
        <p className={`text-[30px] font-extrabold leading-tight ${surplus < 0 ? "text-ios-red" : "text-ios-green"}`}>
          {money(surplus, currency)}
        </p>
        {surplus > 0 && rates && (rates.usd || rates.gold) && (
          <p className="secondary text-[13.5px] mt-1.5 leading-relaxed">
            یعنی تقریباً{" "}
            {rates.usd && <b className="text-[var(--label)]">{fa(Math.floor(surplus / rates.usd))} دلار</b>}
            {rates.usd && rates.gold && " یا "}
            {rates.gold && <b className="text-[var(--label)]">{fa(surplus / rates.gold, 1)} گرم طلا</b>}
            . اگر تومان بماند، تورم کم‌کم ارزشش را می‌خورد.
          </p>
        )}
        {surplus <= 0 && (
          <p className="secondary text-[13.5px] mt-1.5 leading-relaxed">
            این ماه مازادی برای سرمایه‌گذاری ثبت نشده. درآمد و خرجت را با + وارد کن تا ظرفیتت را ببینی.
          </p>
        )}
        <div className="flex gap-4 mt-3 pt-3 border-t border-[var(--sep)]">
          <Mini label="درآمد" value={money(income, currency)} tone="green" />
          <Mini label="هزینه" value={money(expense, currency)} tone="red" />
        </div>
      </Card>

      {/* نرخِ زنده‌ی بازار */}
      <RatesStrip rates={rates} />

      {/* مشاورِ سرمایه (AI) */}
      <button
        onClick={() => setChatOpen(true)}
        className="w-full text-right card p-4 flex items-center gap-3.5 active:scale-[0.99] transition"
      >
        <span className="h-11 w-11 shrink-0 rounded-2xl bg-ios-green/12 text-ios-green flex items-center justify-center">
          <AppIcon name="invest" size={22} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-bold">از مشاورِ سرمایه بپرس</p>
          <p className="secondary text-[13px] leading-snug">یاد بگیر چطور ارزشِ پولت را حفظ کنی و به هدف خریدت برسی</p>
        </div>
        <span className="text-[var(--secondary)]"><AppIcon name="sparkles" size={18} /></span>
      </button>

      {/* هدف‌های خرید */}
      <div className="flex items-center justify-between px-1 pt-2">
        <h3 className="font-bold text-[17px]">هدف‌های خرید</h3>
        <button onClick={() => setOpenGoal(true)} className="text-ios-blue text-[14px] font-semibold active:opacity-60 flex items-center gap-1">
          <AppIcon name="plus" size={15} /> هدفِ جدید
        </button>
      </div>

      {activeGoals.length === 0 ? (
        <Card>
          <EmptyState
            icon="target"
            title="یک هدفِ خرید بگذار"
            sub="مثلاً گوشی یا ماشین. هدف را برحسبِ دلار یا طلا بگذار تا تورم بی‌اثرش کند."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {activeGoals.map((g) => (
            <GoalCard key={g.id} goal={g} rates={rates} currency={currency} onSave={() => setSaveGoal(g)} onChanged={load} />
          ))}
        </div>
      )}

      {/* تفکیکِ خرج */}
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

      {/* تراکنش‌ها */}
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
              <button onClick={() => removeTx(t.id)} className="text-ios-red/70 active:opacity-50 text-[20px] leading-none px-1">×</button>
            </div>
          ))}
        </Card>
      )}

      <AddTxSheet open={openTx} onClose={() => setOpenTx(false)} onAdded={load} />
      <AddGoalSheet open={openGoal} onClose={() => setOpenGoal(false)} rates={rates} currency={currency} onAdded={load} />
      <SaveSheet goal={saveGoal} onClose={() => setSaveGoal(null)} currency={currency} onSaved={load} />
      <InvestChat open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: "red" | "green" }) {
  return (
    <div className="flex-1">
      <p className="secondary text-[12px]">{label}</p>
      <p className={`font-bold text-[15px] ${tone === "red" ? "text-ios-red" : tone === "green" ? "text-ios-green" : ""}`}>{value}</p>
    </div>
  );
}

const RATE_SOURCE_LABEL: Record<string, string> = {
  live: "نرخِ زنده‌ی بازارِ آزاد",
  global: "نرخِ تقریبی از منابعِ جهانی",
  fallback: "آخرین نرخِ ثبت‌شده",
};

function RatesStrip({ rates }: { rates: MarketRates | null }) {
  if (!rates) return null;
  const items: { label: string; icon: string; value: number | null; compact?: boolean }[] = [
    { label: "دلار", icon: "dollar", value: rates.usd },
    { label: "طلای ۱۸", icon: "gold", value: rates.gold, compact: true },
    { label: "سکه", icon: "coin", value: rates.coin, compact: true },
    { label: "بیت‌کوین", icon: "bitcoin", value: rates.btc, compact: true },
  ];
  const has = items.some((i) => i.value);
  if (!has) {
    return (
      <Card className="!py-3">
        <p className="secondary text-[13px] text-center">نرخِ زنده‌ی بازار الان در دسترس نیست — بعداً دوباره تلاش کن.</p>
      </Card>
    );
  }
  return (
    <Card className="!p-0 overflow-hidden">
      <div className="grid grid-cols-2">
        {items.map((it, i) => (
          <div key={it.label} className={`px-3 py-3 text-center ${i % 2 === 0 ? "border-l border-[var(--sep)]" : ""} ${i < 2 ? "border-b border-[var(--sep)]" : ""}`}>
            <span className="text-ios-orange inline-flex"><AppIcon name={it.icon} size={16} /></span>
            <p className="secondary text-[11.5px] mt-0.5">{it.label}</p>
            <p className="font-bold text-[14px] leading-tight mt-0.5">{it.value ? (it.compact ? faShort(it.value) : fa(it.value)) : "—"}</p>
          </div>
        ))}
      </div>
      <div className="px-4 py-1.5 text-center border-t border-[var(--sep)]">
        <span className="secondary text-[11px]">تومان · {RATE_SOURCE_LABEL[rates.source] || "نرخِ بازار"}</span>
      </div>
    </Card>
  );
}

function GoalCard({
  goal, rates, currency, onSave, onChanged,
}: {
  goal: PurchaseGoal; rates: MarketRates | null; currency: string; onSave: () => void; onChanged: () => void;
}) {
  const meta = DENOM[goal.denom];
  const target = tomanTarget(goal, rates);
  const pct = target ? Math.min(1, goal.saved_toman / target) : 0;
  const remaining = target ? Math.max(0, target - goal.saved_toman) : null;
  const reached = target != null && goal.saved_toman >= target;
  const savedNative = rates && meta.rateKey && rates[meta.rateKey]
    ? goal.saved_toman / (rates[meta.rateKey] as number)
    : null;

  async function archive() {
    await apiSend(`/api/goals?id=${goal.id}`, "DELETE");
    onChanged();
  }

  return (
    <Card>
      <div className="flex items-center gap-3 mb-3">
        <span className="h-10 w-10 shrink-0 rounded-xl bg-ios-blue/10 text-ios-blue flex items-center justify-center">
          <AppIcon name={goal.emoji} size={20} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-bold truncate">{goal.title}</p>
          <p className="secondary text-[12.5px] flex items-center gap-1">
            <AppIcon name={meta.icon} size={12} />
            هدف: {fa(Number(goal.target_native), goal.denom === "gold" ? 1 : 0)} {meta.unit}
            {goal.denom !== "toman" && target ? ` ≈ ${money(target, currency)}` : ""}
          </p>
        </div>
        <button onClick={archive} className="text-[var(--secondary)] active:opacity-50 text-[20px] leading-none px-1">×</button>
      </div>

      <div className="h-2.5 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct * 100}%`, backgroundImage: "linear-gradient(90deg, #6fa386, #3aa6b8)" }}
        />
      </div>
      <div className="flex items-center justify-between mt-1.5 text-[13px]">
        <span className="font-semibold">{money(goal.saved_toman, currency)}</span>
        <span className="secondary">{target ? `${fa(Math.round(pct * 100))}٪` : "نرخ نامشخص"}</span>
      </div>

      {/* نکته‌ی ضدِ تورم */}
      <p className="text-[12.5px] leading-relaxed mt-2.5 rounded-xl px-3 py-2 bg-black/[0.035] dark:bg-white/[0.05]">
        {meta.antiInflation ? (
          <>
            <span className="text-ios-green font-semibold">ضدِ تورم 👍</span>{" "}
            چون هدف به {meta.label} بسته‌ست، با گران‌شدنِ دلار، مبلغِ تومانیِ هدف هم بالا می‌رود — ارزش حفظ می‌شود.
            {savedNative != null && ` تا حالا معادلِ ${fa(savedNative, goal.denom === "gold" ? 1 : 0)} ${meta.unit} کنار گذاشته‌ای.`}
          </>
        ) : (
          <>
            <span className="text-ios-orange font-semibold">هشدارِ تورم</span>{" "}
            هدفت به تومانه؛ با تورم قدرتِ خریدش کم می‌شود.
            {rates?.usd && ` الان این هدف ≈ ${fa(Math.round(Number(goal.target_native) / rates.usd))} دلار است؛ بهتره به دلار/طلا فکر کنی.`}
          </>
        )}
      </p>

      {reached ? (
        <div className="mt-3 text-center text-ios-green font-bold text-[14px]">🎉 به هدف رسیدی!</div>
      ) : (
        <div className="flex items-center gap-2 mt-3">
          <Button onClick={onSave} className="flex-1 !py-2.5 flex items-center justify-center gap-1.5">
            <AppIcon name="plus" size={16} /> افزودن پس‌انداز
          </Button>
          {remaining != null && (
            <span className="secondary text-[12.5px] whitespace-nowrap">{money(remaining, currency)} مانده</span>
          )}
        </div>
      )}
    </Card>
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
      await apiSend("/api/transactions", "POST", { kind, amount: parseNum(amount), category, note, date: todayISO() });
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
          <MoneyInput value={amount} onChange={setAmount} />
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

function AddGoalSheet({
  open, onClose, rates, currency, onAdded,
}: {
  open: boolean; onClose: () => void; rates: MarketRates | null; currency: string; onAdded: () => void;
}) {
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("target");
  const [denom, setDenom] = useState<GoalDenom>("usd");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);

  const meta = DENOM[denom];
  const rate = meta.rateKey && rates ? (rates[meta.rateKey] as number | null) : null;
  const tomanPreview = denom === "toman" ? parseNum(target) : rate && target ? parseNum(target) * rate : null;

  async function submit() {
    if (!title.trim() || !target) return;
    setBusy(true);
    try {
      await apiSend("/api/goals", "POST", { title, emoji, denom, target_native: parseNum(target) });
      setTitle(""); setTarget(""); setEmoji("target"); setDenom("usd");
      onAdded();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="هدفِ خرید">
      <div className="space-y-3">
        <Field label="چی می‌خوای بخری؟">
          <input className="ios-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً گوشی، لپ‌تاپ، ماشین" />
        </Field>
        <Field label="آیکون">
          <div className="flex flex-wrap gap-2">
            {GOAL_ICONS.map((ic) => (
              <button
                key={ic}
                onClick={() => setEmoji(ic)}
                className={`h-10 w-10 rounded-xl flex items-center justify-center transition ${
                  emoji === ic ? "bg-ios-blue text-white" : "bg-black/[0.05] dark:bg-white/[0.08]"
                }`}
              >
                <AppIcon name={ic} size={18} />
              </button>
            ))}
          </div>
        </Field>
        <Field label="هدف را برحسبِ چی بگذارم؟">
          <Segmented
            value={denom}
            onChange={(d) => setDenom(d)}
            options={[
              { value: "usd", label: "دلار" },
              { value: "gold", label: "طلا" },
              { value: "coin", label: "سکه" },
              { value: "toman", label: "تومان" },
            ]}
          />
        </Field>
        <Field label={`مقدارِ هدف (${meta.unit})`}>
          <input className="ios-input text-center text-[22px] font-bold" inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="۰" />
        </Field>
        {denom !== "toman" ? (
          <p className="secondary text-[12.5px] px-1 leading-relaxed">
            ✅ هدف به {meta.label} ضدِتورم است؛ هرچه دلار بالا برود، مبلغِ تومانیِ هدف هم بالا می‌رود و ارزش حفظ می‌شود.
            {tomanPreview ? ` الان ≈ ${money(tomanPreview, currency)}.` : rate === null ? " (نرخِ زنده در دسترس نیست)" : ""}
          </p>
        ) : (
          <p className="secondary text-[12.5px] px-1 leading-relaxed">
            ⚠️ هدفِ تومانی با تورم بی‌ارزش می‌شود. اگر می‌تونی به دلار یا طلا بگذار.
          </p>
        )}
        <Button onClick={submit} disabled={busy || !title.trim() || !target} className="w-full flex items-center justify-center gap-2 mt-1">
          {busy && <Spinner />} ساختنِ هدف
        </Button>
      </div>
    </Sheet>
  );
}

function SaveSheet({
  goal, onClose, currency, onSaved,
}: {
  goal: PurchaseGoal | null; onClose: () => void; currency: string; onSaved: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setAmount(""); }, [goal?.id]);

  async function submit() {
    if (!goal || !amount) return;
    setBusy(true);
    try {
      const next = Number(goal.saved_toman) + parseNum(amount);
      await apiSend("/api/goals", "PUT", { id: goal.id, saved_toman: next });
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={!!goal} onClose={onClose} title="افزودن پس‌انداز">
      <div className="space-y-3">
        {goal && (
          <p className="secondary text-[13.5px] px-1">
            برای «{goal.title}» — تا حالا {money(goal.saved_toman, currency)} کنار گذاشته‌ای.
          </p>
        )}
        <Field label={`مبلغی که این بار کنار می‌گذاری (${currency})`}>
          <MoneyInput value={amount} onChange={setAmount} />
        </Field>
        <Button onClick={submit} disabled={busy || !amount} className="w-full flex items-center justify-center gap-2 mt-1">
          {busy && <Spinner />} افزودن
        </Button>
      </div>
    </Sheet>
  );
}
