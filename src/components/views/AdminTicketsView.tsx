"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiSend } from "@/lib/client";
import { Card, Sheet, Spinner, EmptyState, Segmented, Button } from "@/components/ui";
import {
  CATEGORY_LABEL,
  PRIORITY_LABEL,
  STATUS_LABEL,
  STATUS_DOT,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/support";

/* ───────────────────────── types ───────────────────────── */

type ListTicket = {
  id: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  user_id: string | null;
  contact: string | null;
  display_name: string | null;
  username: string | null;
  msg_count: number;
};

type Message = {
  id: string;
  author_type: "user" | "staff" | "system";
  author_name: string | null;
  body: string;
  is_internal: boolean;
  created_at: string;
};

type TicketDetail = {
  ticket: {
    id: string;
    subject: string;
    body: string;
    category: TicketCategory;
    priority: TicketPriority;
    status: TicketStatus;
    assigned_to: string | null;
    contact: string | null;
    meta: Record<string, unknown> | null;
    user_id: string | null;
    created_at: string;
    updated_at: string;
    resolved_at: string | null;
  };
  user: { username?: string; display_name?: string; phone?: string } | null;
  messages: Message[];
};

/* ───────────────────────── helpers ───────────────────────── */

function fmtTime(s: string) {
  try {
    const d = new Date(s);
    return d.toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return s;
  }
}

/** فاصله‌ی نسبی به فارسی — برای ستونِ «از چقدر پیش». */
function ago(s: string) {
  const t = new Date(s).getTime();
  if (!isFinite(t)) return "—";
  const diff = Math.max(0, Date.now() - t);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "همین الان";
  if (m < 60) return `${m} دقیقه`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ساعت`;
  const d = Math.floor(h / 24);
  return `${d} روز`;
}

const PRI_BG: Record<TicketPriority, string> = {
  p0: "#ff453a",
  p1: "#ff9f0a",
  p2: "#0a84ff",
  p3: "#8e8e93",
};

/* ───────────────────────── main view ───────────────────────── */

type FilterTab = "all" | "active" | "p0p1" | "mine" | "resolved";

export default function AdminTicketsView() {
  const [tickets, setTickets] = useState<ListTicket[] | null>(null);
  const [stats, setStats] = useState<{ status: string; n: number }[]>([]);
  const [tab, setTab] = useState<FilterTab>("active");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setTickets(null);
    const qs = new URLSearchParams();
    if (tab === "active") qs.set("status", "new,open,waiting_user");
    if (tab === "p0p1") qs.set("priority", "p0,p1");
    if (tab === "resolved") qs.set("status", "resolved,closed");
    if (q.trim()) qs.set("q", q.trim());
    try {
      const d = await apiGet<{ tickets: ListTicket[]; stats: { status: string; n: number }[] }>(
        `/api/admin/tickets?${qs.toString()}`
      );
      setTickets(d.tickets);
      setStats(d.stats || []);
    } catch {
      setTickets([]);
    }
  }, [tab, q]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of stats) m[s.status] = s.n;
    return {
      new: m.new || 0,
      open: m.open || 0,
      waiting: m.waiting_user || 0,
      resolved: m.resolved || 0,
      active: (m.new || 0) + (m.open || 0) + (m.waiting_user || 0),
    };
  }, [stats]);

  return (
    <div>
      {/* خلاصه‌ی بالا */}
      <div className="mb-3 grid grid-cols-4 gap-2">
        <SummaryTile label="تازه" value={counts.new} color="#ff453a" />
        <SummaryTile label="در حال" value={counts.open} color="#ff9f0a" />
        <SummaryTile label="منتظر کاربر" value={counts.waiting} color="#0a84ff" />
        <SummaryTile label="حل‌شده" value={counts.resolved} color="#34c759" />
      </div>

      <div className="mb-3">
        <Segmented<FilterTab>
          value={tab}
          onChange={setTab}
          options={[
            { value: "active", label: `فعال (${counts.active})` },
            { value: "p0p1", label: "اولویت بالا" },
            { value: "all", label: "همه" },
            { value: "resolved", label: "حل‌شده" },
          ]}
        />
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="جست‌وجو در موضوع…"
        className="ios-input mb-3 w-full"
      />

      {!tickets ? (
        <Spinner className="mt-10 block mx-auto" />
      ) : tickets.length === 0 ? (
        <EmptyState icon="inbox" title="تیکتی نیست" />
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => (
            <button
              key={t.id}
              onClick={() => setOpenId(t.id)}
              className="block w-full text-right"
            >
              <Card className="hover:opacity-90 transition">
                <div className="flex items-start gap-2">
                  <span
                    className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: STATUS_DOT[t.status] }}
                    title={STATUS_LABEL[t.status]}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                        style={{ background: PRI_BG[t.priority] }}
                      >
                        {PRIORITY_LABEL[t.priority]}
                      </span>
                      <span className="secondary text-[11px]">{CATEGORY_LABEL[t.category]}</span>
                      <span className="secondary mr-auto text-[11px]">{ago(t.created_at)} پیش</span>
                    </div>
                    <div className="mt-1 truncate font-semibold">{t.subject}</div>
                    <div className="secondary mt-0.5 truncate text-[12px]">
                      {t.display_name || t.username || t.contact || "—"}
                      {t.assigned_to && <> · @{t.assigned_to}</>}
                      {t.msg_count > 1 && <> · {t.msg_count} پیام</>}
                    </div>
                  </div>
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}

      {openId && (
        <TicketDetailSheet
          id={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => load()}
        />
      )}
    </div>
  );
}

function SummaryTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card className="text-center">
      <div className="text-[20px] font-bold tabular-nums" style={{ color }}>{value}</div>
      <div className="secondary text-[11px]">{label}</div>
    </Card>
  );
}

/* ───────────────────────── detail sheet ───────────────────────── */

function TicketDetailSheet({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [data, setData] = useState<TicketDetail | null>(null);
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await apiGet<TicketDetail>(`/api/admin/tickets/${id}`);
      setData(d);
    } catch {
      setData(null);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const patch = async (p: Record<string, unknown>) => {
    setBusy(true);
    try {
      await apiSend(`/api/admin/tickets/${id}`, "PATCH", p);
      await load();
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    const body = reply.trim();
    if (!body) return;
    setBusy(true);
    try {
      await apiSend(`/api/admin/tickets/${id}`, "POST", { body, internal });
      setReply("");
      setInternal(false);
      await load();
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={true} onClose={onClose} title="جزئیاتِ تیکت" fillHeight>
      {!data ? (
        <Spinner className="mt-10 block mx-auto" />
      ) : (
        <div className="flex h-full flex-col">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <div className="text-[15px] font-bold">{data.ticket.subject}</div>
            <div className="secondary mt-1 text-[12px]">
              {data.user?.display_name || data.user?.username || data.ticket.contact || "ناشناس"}
              {data.user?.phone && <> · {data.user.phone}</>}
              {" · "}
              {fmtTime(data.ticket.created_at)}
            </div>

            {/* کنترل‌های وضعیت/اولویت/دسته */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              <select
                value={data.ticket.status}
                onChange={(e) => patch({ status: e.target.value })}
                disabled={busy}
                className="ios-input !py-2 text-[12px]"
              >
                {TICKET_STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
              <select
                value={data.ticket.priority}
                onChange={(e) => patch({ priority: e.target.value })}
                disabled={busy}
                className="ios-input !py-2 text-[12px]"
              >
                {TICKET_PRIORITIES.map((p) => (
                  <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
                ))}
              </select>
              <select
                value={data.ticket.category}
                onChange={(e) => patch({ category: e.target.value })}
                disabled={busy}
                className="ios-input !py-2 text-[12px]"
              >
                {TICKET_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* پیام‌ها */}
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
            {data.messages.map((m) => (
              <MessageBubble key={m.id} m={m} />
            ))}
            {data.messages.length === 0 && (
              <div className="secondary text-center text-[12px]">پیامی نیست.</div>
            )}
          </div>

          {/* فرمِ پاسخ */}
          <div className="border-t border-[var(--border)] px-4 py-3">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder={internal ? "یادداشتِ داخلی (به کاربر نمی‌رسد)…" : "پاسخ به کاربر…"}
              rows={3}
              className="ios-input w-full text-[13px]"
            />
            <div className="mt-2 flex items-center gap-2">
              <label className="flex items-center gap-1 text-[12px]">
                <input
                  type="checkbox"
                  checked={internal}
                  onChange={(e) => setInternal(e.target.checked)}
                />
                یادداشتِ داخلی
              </label>
              <div className="flex-1" />
              <Button onClick={send} disabled={busy || !reply.trim()}>ارسال</Button>
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function MessageBubble({ m }: { m: Message }) {
  const isStaff = m.author_type === "staff";
  const bg = m.is_internal
    ? "rgba(255,159,10,0.12)"
    : isStaff
    ? "rgba(10,132,255,0.10)"
    : "rgba(0,0,0,0.04)";
  return (
    <div className="rounded-2xl p-3" style={{ background: bg }}>
      <div className="secondary mb-1 flex items-center gap-2 text-[10px]">
        <span className="font-semibold">
          {m.is_internal ? "🔒 یادداشت" : isStaff ? "🌱 پشتیبانی" : "👤 کاربر"}
          {m.author_name ? ` · ${m.author_name}` : ""}
        </span>
        <span className="mr-auto">{fmtTime(m.created_at)}</span>
      </div>
      <div className="whitespace-pre-wrap text-[13px] leading-6">{m.body}</div>
    </div>
  );
}
