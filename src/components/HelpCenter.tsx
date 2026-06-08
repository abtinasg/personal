"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiSend } from "@/lib/client";
import { Sheet, Spinner, EmptyState, Button, Field, Chevron } from "@/components/ui";
import {
  CATEGORY_LABEL,
  STATUS_LABEL,
  STATUS_DOT,
  TICKET_CATEGORIES,
  type TicketCategory,
  type TicketStatus,
} from "@/lib/support";

/* ───────────────────────── types ───────────────────────── */

type Faq = {
  id: string;
  slug: string;
  question: string;
  short_answer: string;
  body: string;
  category: string;
};

type MyTicket = {
  id: string;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  created_at: string;
};

type TicketDetail = {
  ticket: {
    id: string;
    subject: string;
    body: string;
    category: TicketCategory;
    status: TicketStatus;
    created_at: string;
  };
  messages: {
    id: string;
    author_type: "user" | "staff" | "system";
    author_name: string | null;
    body: string;
    created_at: string;
  }[];
};

type View = "home" | "faq" | "new" | "list" | "detail";

/* ───────────────────────── helpers ───────────────────────── */

function fmtTime(s: string) {
  try {
    return new Date(s).toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return s;
  }
}

const FAQ_CAT_ORDER = ["auth", "otp", "subscription", "payment", "ai_quality", "notification", "bug", "data", "refund", "general"];

/* ───────────────────────── main ───────────────────────── */

export default function HelpCenter({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [view, setView] = useState<View>("home");
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);

  // reset به home وقتی شیت بسته می‌شود
  useEffect(() => {
    if (!open) {
      setView("home");
      setOpenTicketId(null);
    }
  }, [open]);

  return (
    <Sheet open={open} onClose={onClose} title="راهنما و پشتیبانی 🌱" fillHeight>
      <div className="flex h-full flex-col">
        {view !== "home" && (
          <div className="border-b border-[var(--border)] px-4 py-2">
            <button
              onClick={() => {
                if (view === "detail") setView("list");
                else setView("home");
              }}
              className="flex items-center gap-1 text-[13px] text-ios-blue"
            >
              <Chevron dir="back" size={16} />
              بازگشت
            </button>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {view === "home" && <HomeView onPick={setView} />}
          {view === "faq" && <FaqView />}
          {view === "new" && (
            <NewTicketForm
              onCreated={(id) => {
                setOpenTicketId(id);
                setView("detail");
              }}
            />
          )}
          {view === "list" && (
            <TicketListView
              onOpen={(id) => {
                setOpenTicketId(id);
                setView("detail");
              }}
              onNew={() => setView("new")}
            />
          )}
          {view === "detail" && openTicketId && <TicketDetailView id={openTicketId} />}
        </div>
      </div>
    </Sheet>
  );
}

/* ───────────────────────── home ───────────────────────── */

function HomeView({ onPick }: { onPick: (v: View) => void }) {
  return (
    <div className="space-y-3">
      <p className="secondary text-[13px] leading-6">
        قبل از تیکت، توی پرسش‌های پرتکرار جواب رو ببین — معمولاً سریع‌تر حل می‌شه. اگر چیزی نبود، تیکت بزن.
      </p>
      <HomeRow icon="❓" title="پرسش‌های پرتکرار" sub="پاسخ‌های فوریِ متداول" onClick={() => onPick("faq")} />
      <HomeRow icon="✉️" title="ارسالِ تیکتِ جدید" sub="با تیمِ پشتیبانی حرف بزن" onClick={() => onPick("new")} />
      <HomeRow icon="📂" title="تیکت‌های من" sub="پیگیریِ تیکت‌های قبلی" onClick={() => onPick("list")} />
    </div>
  );
}

function HomeRow({
  icon,
  title,
  sub,
  onClick,
}: {
  icon: string;
  title: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl bg-[var(--label)]/[0.05] px-4 py-3.5 text-right active:opacity-60"
    >
      <span className="text-[22px]">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block font-semibold text-[15px]">{title}</span>
        <span className="secondary block text-[12px]">{sub}</span>
      </span>
      <Chevron dir="forward" size={18} className="secondary" />
    </button>
  );
}

/* ───────────────────────── FAQ ───────────────────────── */

function FaqView() {
  const [faqs, setFaqs] = useState<Faq[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    apiGet<{ faqs: Faq[] }>("/api/support/faqs")
      .then((d) => setFaqs(d.faqs))
      .catch(() => setFaqs([]));
  }, []);

  const filtered = useMemo(() => {
    if (!faqs) return null;
    const t = q.trim();
    if (!t) return faqs;
    const lower = t.toLowerCase();
    return faqs.filter(
      (f) => f.question.toLowerCase().includes(lower) || f.short_answer.toLowerCase().includes(lower)
    );
  }, [faqs, q]);

  const grouped = useMemo(() => {
    if (!filtered) return null;
    const m = new Map<string, Faq[]>();
    for (const f of filtered) {
      const arr = m.get(f.category) || [];
      arr.push(f);
      m.set(f.category, arr);
    }
    return FAQ_CAT_ORDER.filter((c) => m.has(c)).map((c) => ({ cat: c, items: m.get(c)! }));
  }, [filtered]);

  if (!faqs) return <Spinner className="mt-10 block mx-auto" />;

  return (
    <div className="space-y-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="جست‌وجو…"
        className="ios-input w-full"
      />
      {!grouped || grouped.length === 0 ? (
        <EmptyState icon="inbox" title="چیزی پیدا نشد" />
      ) : (
        grouped.map((g) => (
          <div key={g.cat}>
            <div className="secondary mb-2 px-1 text-[12px] font-bold">
              {CATEGORY_LABEL[(g.cat as TicketCategory)] || g.cat}
            </div>
            <div className="space-y-2">
              {g.items.map((f) => (
                <div key={f.id} className="rounded-2xl bg-[var(--label)]/[0.05] p-3">
                  <button
                    onClick={() => setOpenId(openId === f.id ? null : f.id)}
                    className="flex w-full items-start justify-between gap-2 text-right"
                  >
                    <span className="flex-1 font-semibold text-[14px]">{f.question}</span>
                    <span className="secondary text-[14px]">{openId === f.id ? "−" : "+"}</span>
                  </button>
                  <div className="secondary mt-1 text-[12px]">{f.short_answer}</div>
                  {openId === f.id && (
                    <div className="mt-2 whitespace-pre-wrap border-t border-[var(--border)] pt-2 text-[13px] leading-6">
                      {f.body}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* ───────────────────────── new ticket ───────────────────────── */

function NewTicketForm({ onCreated }: { onCreated: (id: string) => void }) {
  const [category, setCategory] = useState<TicketCategory>("general");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    if (subject.trim().length < 3) return setErr("موضوع کوتاه است.");
    if (body.trim().length < 5) return setErr("توضیحات کوتاه است.");
    setBusy(true);
    try {
      const meta = typeof window !== "undefined" ? { url: window.location.href, ua: navigator.userAgent } : undefined;
      const { id } = await apiSend<{ id: string }>("/api/support/tickets", "POST", {
        subject: subject.trim(),
        body: body.trim(),
        category,
        meta,
      });
      onCreated(id);
    } catch (e) {
      setErr((e as Error).message || "خطا در ثبت تیکت.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <Field label="دسته‌بندی">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as TicketCategory)}
          className="ios-input w-full"
        >
          {TICKET_CATEGORIES.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
          ))}
        </select>
      </Field>
      <Field label="موضوع">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="مثلاً: پرداخت کردم ولی پلن فعال نشد"
          className="ios-input w-full"
          maxLength={200}
        />
      </Field>
      <Field label="توضیحات">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="هرچه بیشتر جزئیات بنویسی، سریع‌تر کمکت می‌کنیم."
          rows={6}
          className="ios-input w-full"
          maxLength={5000}
        />
      </Field>
      {err && <p className="text-[13px] text-ios-red">{err}</p>}
      <Button onClick={submit} disabled={busy} className="w-full">
        {busy ? "در حال ارسال…" : "ارسالِ تیکت"}
      </Button>
      <p className="secondary text-center text-[11px]">
        معمولاً تا چند ساعت پاسخ می‌دیم. اولویتِ پرداخت/داده فوری‌اند.
      </p>
    </div>
  );
}

/* ───────────────────────── list & detail ───────────────────────── */

function TicketListView({ onOpen, onNew }: { onOpen: (id: string) => void; onNew: () => void }) {
  const [items, setItems] = useState<MyTicket[] | null>(null);

  const load = useCallback(() => {
    setItems(null);
    apiGet<{ tickets: MyTicket[] }>("/api/support/tickets")
      .then((d) => setItems(d.tickets))
      .catch(() => setItems([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!items) return <Spinner className="mt-10 block mx-auto" />;

  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <EmptyState icon="inbox" title="هنوز تیکتی نزدی" sub="اگه سوال یا مشکلی داری بفرست." />
      ) : (
        items.map((t) => (
          <button
            key={t.id}
            onClick={() => onOpen(t.id)}
            className="block w-full rounded-2xl bg-[var(--label)]/[0.05] p-3 text-right active:opacity-60"
          >
            <div className="flex items-start gap-2">
              <span
                className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: STATUS_DOT[t.status] }}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-[14px]">{t.subject}</div>
                <div className="secondary mt-0.5 text-[11px]">
                  {STATUS_LABEL[t.status]} · {CATEGORY_LABEL[t.category]} · {fmtTime(t.created_at)}
                </div>
              </div>
            </div>
          </button>
        ))
      )}
      <Button onClick={onNew} variant="ghost" className="w-full">+ تیکتِ جدید</Button>
    </div>
  );
}

function TicketDetailView({ id }: { id: string }) {
  const [data, setData] = useState<TicketDetail | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiGet<TicketDetail>(`/api/support/tickets/${id}`)
      .then(setData)
      .catch(() => setData(null));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const send = async () => {
    const body = reply.trim();
    if (!body) return;
    setBusy(true);
    try {
      await apiSend(`/api/support/tickets/${id}`, "POST", { body });
      setReply("");
      load();
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <Spinner className="mt-10 block mx-auto" />;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2">
        <div className="font-bold text-[15px]">{data.ticket.subject}</div>
        <div className="secondary text-[11px]">
          {STATUS_LABEL[data.ticket.status]} · {CATEGORY_LABEL[data.ticket.category]} · {fmtTime(data.ticket.created_at)}
        </div>
      </div>

      <div className="space-y-2">
        {data.messages.map((m) => {
          const isStaff = m.author_type === "staff";
          return (
            <div
              key={m.id}
              className="rounded-2xl p-3"
              style={{ background: isStaff ? "rgba(10,132,255,0.10)" : "rgba(0,0,0,0.04)" }}
            >
              <div className="secondary mb-1 text-[10px]">
                {isStaff ? "🌱 پشتیبانی" : "👤 شما"}
                {m.author_name ? ` · ${m.author_name}` : ""} · {fmtTime(m.created_at)}
              </div>
              <div className="whitespace-pre-wrap text-[13px] leading-6">{m.body}</div>
            </div>
          );
        })}
      </div>

      {data.ticket.status !== "closed" && (
        <div className="mt-3 border-t border-[var(--border)] pt-3">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="پاسخت…"
            rows={3}
            className="ios-input w-full text-[13px]"
          />
          <Button onClick={send} disabled={busy || !reply.trim()} className="mt-2 w-full">
            ارسالِ پاسخ
          </Button>
        </div>
      )}
    </div>
  );
}
