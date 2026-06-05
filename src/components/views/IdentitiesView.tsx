"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/client";
import { fa } from "@/lib/format";
import { type Identity, identityLevel } from "@/lib/types";
import { Card, Sheet, Field, Button, Spinner, EmptyState, SectionTitle, useConfirm } from "@/components/ui";
import { AddButton } from "@/components/views/CaloriesView";
import { AppIcon, IDENTITY_ICONS } from "@/components/AppIcon";

const COLORS = ["#16517d", "#1f6ca6", "#6fa386", "#ef9d63", "#f08197", "#8f86e6", "#3aa6b8"];

export default function IdentitiesView() {
  const [items, setItems] = useState<Identity[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const { confirm, dialog } = useConfirm();

  const load = useCallback(async () => {
    const { identities } = await apiGet<{ identities: Identity[] }>("/api/identities");
    setItems(identities);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(it: Identity) {
    if (!(await confirm({ title: "حذف هویت", message: `«${it.name}» حذف شود؟ عادت‌های مرتبط حذف نمی‌شوند.`, confirmLabel: "حذف", danger: true }))) return;
    setItems((xs) => xs.filter((x) => x.id !== it.id));
    await apiSend(`/api/identities?id=${it.id}`, "DELETE");
  }

  return (
    <div className="space-y-3">
      <SectionTitle
        action={
          <div className="flex items-center gap-3">
            {items.length > 0 && (
              <button onClick={() => setEdit((e) => !e)} className="text-ios-blue text-[15px] font-medium">
                {edit ? "تمام" : "ویرایش"}
              </button>
            )}
            <AddButton onClick={() => setOpen(true)} />
          </div>
        }
      >
        هویت‌ها
      </SectionTitle>

      <p className="secondary text-[14px] leading-relaxed px-1">
        هر عادتی که انجام می‌دی، یک رأیه به آدمی که می‌خوای بشی. اینجا می‌بینی داری به کدوم «خود» نزدیک‌تر می‌شی.
      </p>

      {loading ? (
        <Card className="flex justify-center py-8"><Spinner /></Card>
      ) : items.length === 0 ? (
        <Card><EmptyState icon="star" title="هنوز هویتی نساختی" sub="مثلاً «آدمِ سالم» یا «دانشجوی منظم»" /></Card>
      ) : (
        <div className="space-y-3">
          {items.map((it) => {
            const lv = identityLevel(it.vote_total);
            return (
              <Card key={it.id} className="!p-0 overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <span
                      className="h-12 w-12 rounded-2xl flex items-center justify-center shrink-0"
                      style={{ background: it.color + "22", color: it.color }}
                    >
                      <AppIcon name={it.emoji} size={24} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-extrabold text-[17px] truncate">{it.name}</p>
                        <span className="chip !py-0.5 !px-2 text-[11px]" style={{ background: it.color + "22", color: it.color }}>
                          سطح {fa(lv.level)}
                        </span>
                      </div>
                      {it.statement && <p className="secondary text-[13px] mt-0.5 leading-relaxed">«{it.statement}»</p>}
                    </div>
                    {edit && (
                      <button onClick={() => remove(it)} className="text-ios-red text-[14px] font-medium px-1 shrink-0">حذف</button>
                    )}
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1.5 text-[12px]">
                      <span className="secondary">{fa(lv.inLevel)} / {fa(lv.needed)} رأی تا سطح بعد</span>
                      <span className="font-semibold" style={{ color: it.color }}>{fa(it.vote_total)} رأی</span>
                    </div>
                    <div className="track">
                      <div className="h-full rounded-full transition-all" style={{ width: `${lv.progress * 100}%`, background: it.color }} />
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <span className="chip inline-flex items-center gap-1.5"><AppIcon name="vote" size={14} /> این هفته: {fa(it.vote_week)}</span>
                    <span className="chip inline-flex items-center gap-1.5"><AppIcon name="repeat" size={14} /> {fa(it.habit_count)} عادت</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <AddIdentitySheet open={open} onClose={() => setOpen(false)} onAdded={load} />
      {dialog}
    </div>
  );
}

function AddIdentitySheet({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: () => void }) {
  const [name, setName] = useState("");
  const [statement, setStatement] = useState("");
  const [emoji, setEmoji] = useState(IDENTITY_ICONS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await apiSend("/api/identities", "POST", { name, statement, emoji, color });
      setName(""); setStatement(""); setEmoji(IDENTITY_ICONS[0]); setColor(COLORS[0]);
      onAdded();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="هویت جدید">
      <div className="space-y-4">
        <Field label="می‌خوای چه آدمی بشی؟">
          <input className="ios-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً آدمِ سالم و پرانرژی" autoFocus />
        </Field>
        <Field label="جمله‌ی هویت (اول‌شخص)">
          <input className="ios-input" value={statement} onChange={(e) => setStatement(e.target.value)} placeholder="من کسی‌ام که هر روز به بدنش می‌رسه" />
        </Field>
        <Field label="آیکون">
          <div className="flex flex-wrap gap-2">
            {IDENTITY_ICONS.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={`h-10 w-10 rounded-xl flex items-center justify-center transition ${
                  emoji === e ? "bg-ios-blue/15 ring-2 ring-ios-blue text-ios-blue" : "bg-black/[0.05] dark:bg-white/[0.08]"
                }`}
              >
                <AppIcon name={e} size={20} />
              </button>
            ))}
          </div>
        </Field>
        <Field label="رنگ">
          <div className="flex gap-2.5">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="h-9 w-9 rounded-full transition active:scale-90"
                style={{ background: c, outline: color === c ? `3px solid ${c}55` : "none", outlineOffset: 2 }}
              />
            ))}
          </div>
        </Field>
        <Button onClick={submit} disabled={busy || !name.trim()} className="w-full flex items-center justify-center gap-2">
          {busy && <Spinner />} ساخت هویت
        </Button>
      </div>
    </Sheet>
  );
}
