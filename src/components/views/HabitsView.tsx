"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiSend } from "@/lib/client";
import { fa, todayISO, daysAgoISO } from "@/lib/format";
import type { Habit, HabitLog, Identity } from "@/lib/types";
import { Card, Ring, Sheet, Field, Button, Spinner, EmptyState, SectionTitle, useConfirm } from "@/components/ui";
import { AddButton } from "@/components/views/CaloriesView";
import { AppIcon, HABIT_ICONS } from "@/components/AppIcon";

const COLORS = ["#22c391", "#5b76f0", "#fb9a5b", "#fb7fa0", "#a96ff0", "#2cb8cf", "#f5c451"];

export default function HabitsView() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const { confirm, dialog } = useConfirm();
  const today = todayISO();
  const yesterday = daysAgoISO(1);

  const load = useCallback(async () => {
    const [{ habits, logs }, { identities }] = await Promise.all([
      apiGet<{ habits: Habit[]; logs: HabitLog[] }>(`/api/habits?from=${daysAgoISO(90)}`),
      apiGet<{ identities: Identity[] }>("/api/identities"),
    ]);
    setHabits(habits);
    setLogs(logs);
    setIdentities(identities);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const doneSet = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const l of logs) {
      if (!map.has(l.habit_id)) map.set(l.habit_id, new Set());
      map.get(l.habit_id)!.add(l.done_on);
    }
    return map;
  }, [logs]);

  const doneTodayCount = habits.filter((h) => doneSet.get(h.id)?.has(today)).length;

  async function toggle(habit: Habit) {
    const set = doneSet.get(habit.id);
    const isDone = set?.has(today);
    if (isDone) {
      setLogs((l) => l.filter((x) => !(x.habit_id === habit.id && x.done_on === today)));
    } else {
      setLogs((l) => [...l, { id: "tmp" + Math.random(), habit_id: habit.id, done_on: today, count: 1 }]);
    }
    await apiSend("/api/habits/toggle", "POST", { habitId: habit.id, date: today });
  }

  async function remove(h: Habit) {
    if (!(await confirm({ title: "حذف عادت", message: `«${h.name}» حذف شود؟ تاریخچه‌اش هم پاک می‌شود.`, confirmLabel: "حذف", danger: true }))) return;
    setHabits((hs) => hs.filter((x) => x.id !== h.id));
    await apiSend(`/api/habits?id=${h.id}`, "DELETE");
  }

  function streak(habitId: string): number {
    const set = doneSet.get(habitId);
    if (!set) return 0;
    let n = 0;
    const d = new Date();
    if (!set.has(todayISO(d))) d.setDate(d.getDate() - 1);
    while (set.has(todayISO(d))) {
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }

  const last7 = Array.from({ length: 7 }, (_, i) => daysAgoISO(6 - i));

  // گروه‌بندی بر اساس هویت: هویت‌ها به‌ترتیب، بعد عادت‌های بدون هویت
  const groups = useMemo(() => {
    const byId = new Map<string, Habit[]>();
    const none: Habit[] = [];
    for (const h of habits) {
      if (h.identity_id) {
        if (!byId.has(h.identity_id)) byId.set(h.identity_id, []);
        byId.get(h.identity_id)!.push(h);
      } else {
        none.push(h);
      }
    }
    const out: { identity: Identity | null; habits: Habit[] }[] = [];
    for (const idn of identities) {
      const hs = byId.get(idn.id);
      if (hs && hs.length) out.push({ identity: idn, habits: hs });
    }
    if (none.length) out.push({ identity: null, habits: none });
    return out;
  }, [habits, identities]);

  function renderHabit(h: Habit) {
    const done = doneSet.get(h.id)?.has(today);
    const st = streak(h.id);
    const missedYesterday = !doneSet.get(h.id)?.has(yesterday) && !done && st === 0 && (doneSet.get(h.id)?.size || 0) > 0;
    return (
      <Card key={h.id} className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span style={{ color: h.color }}><AppIcon name={h.emoji} size={22} /></span>
            <p className="font-bold truncate">{h.name}</p>
          </div>
          <p className="secondary text-[13px] mt-1 flex items-center gap-1">
            {st > 0 ? (
              <><span className="text-ios-orange"><AppIcon name="flame" size={14} /></span> {fa(st)} روز پیاپی</>
            ) : missedYesterday ? (
              <><span className="text-ios-yellow"><AppIcon name="alert" size={14} /></span> دیروز جا موند — امروز نذار دوبار بشه</>
            ) : (
              "امروز شروع کن"
            )}
          </p>
          {h.cue && <p className="secondary text-[12px] mt-0.5 flex items-center gap-1"><AppIcon name="cue" size={12} /> {h.cue}</p>}
          {h.min_version && !done && <p className="secondary text-[12px] mt-0.5 flex items-center gap-1"><AppIcon name="feather" size={12} /> حداقلش: {h.min_version}</p>}
          <div className="flex gap-1.5 mt-2">
            {last7.map((d) => {
              const ok = doneSet.get(h.id)?.has(d);
              return (
                <span
                  key={d}
                  className="h-3 w-3 rounded-full"
                  style={{ background: ok ? h.color : "color-mix(in srgb, var(--label) 12%, transparent)" }}
                />
              );
            })}
          </div>
        </div>

        {edit ? (
          <button onClick={() => remove(h)} className="text-ios-red text-[15px] font-medium px-2">حذف</button>
        ) : (
          <button
            onClick={() => toggle(h)}
            className="h-12 w-12 rounded-full flex items-center justify-center transition active:scale-90 shrink-0"
            style={{
              background: done ? h.color : "transparent",
              border: done ? "none" : `2.5px solid ${h.color}`,
              color: done ? "#fff" : h.color,
            }}
          >
            {done ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 12 4.5 4.5L19 7" />
              </svg>
            ) : (
              <span className="text-[22px] leading-none">+</span>
            )}
          </button>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <SectionTitle
        action={
          <div className="flex items-center gap-3">
            {habits.length > 0 && (
              <button onClick={() => setEdit((e) => !e)} className="text-ios-blue text-[15px] font-medium">
                {edit ? "تمام" : "ویرایش"}
              </button>
            )}
            <AddButton onClick={() => setOpen(true)} />
          </div>
        }
      >
        عادت‌ها
      </SectionTitle>

      {habits.length > 0 && (
        <Card className="flex items-center gap-5">
          <Ring progress={habits.length ? doneTodayCount / habits.length : 0} color="#22c391" size={120} stroke={13}>
            <span className="text-[26px] font-extrabold leading-none">{fa(doneTodayCount)}<span className="secondary text-[16px]">/{fa(habits.length)}</span></span>
            <span className="secondary text-[11px] mt-1">امروز</span>
          </Ring>
          <div className="flex-1">
            <p className="font-bold text-[17px] flex items-center gap-1.5">
              {doneTodayCount === habits.length ? (
                <><span className="text-ios-green"><AppIcon name="celebrate" size={18} /></span> امروز به همه‌ی خودهات رأی دادی!</>
              ) : (
                "هر تیک، یک رأی به آدمیه که می‌خوای بشی"
              )}
            </p>
            <p className="secondary text-[14px] mt-1">
              {fa(habits.length - doneTodayCount)} رأی باقی مانده برای امروز
            </p>
          </div>
        </Card>
      )}

      {loading ? (
        <Card className="flex justify-center py-8"><Spinner /></Card>
      ) : habits.length === 0 ? (
        <Card><EmptyState icon="target" title="هنوز عادتی نساختی" sub="با + اولین عادتت رو اضافه کن" /></Card>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.identity?.id || "none"} className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                {g.identity ? (
                  <>
                    <span style={{ color: g.identity.color }}><AppIcon name={g.identity.emoji} size={18} /></span>
                    <p className="font-bold text-[15px]">{g.identity.name}</p>
                    <span className="chip !py-0.5 !px-2 text-[11px]" style={{ background: g.identity.color + "22", color: g.identity.color }}>
                      {fa(g.identity.vote_total)} رأی
                    </span>
                  </>
                ) : (
                  <p className="font-bold text-[15px] secondary">متفرقه</p>
                )}
              </div>
              {g.habits.map(renderHabit)}
            </div>
          ))}
        </div>
      )}

      <AddHabitSheet open={open} onClose={() => setOpen(false)} onAdded={load} identities={identities} />
      {dialog}
    </div>
  );
}

function AddHabitSheet({
  open,
  onClose,
  onAdded,
  identities,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
  identities: Identity[];
}) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(HABIT_ICONS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [identityId, setIdentityId] = useState<string | null>(null);
  const [cue, setCue] = useState("");
  const [minVersion, setMinVersion] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await apiSend("/api/habits", "POST", {
        name,
        emoji,
        color,
        identity_id: identityId,
        cue: cue.trim() || null,
        min_version: minVersion.trim() || null,
      });
      setName(""); setEmoji(HABIT_ICONS[0]); setColor(COLORS[0]); setIdentityId(null); setCue(""); setMinVersion("");
      onAdded();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="عادت جدید">
      <div className="space-y-4">
        <Field label="اسم عادت">
          <input className="ios-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً نوشیدن آب کافی" autoFocus />
        </Field>

        {identities.length > 0 && (
          <Field label="رأی به کدوم هویت؟">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setIdentityId(null)}
                className={`chip ${identityId === null ? "ring-2 ring-ios-blue" : ""}`}
              >
                بدون
              </button>
              {identities.map((idn) => (
                <button
                  key={idn.id}
                  onClick={() => { setIdentityId(idn.id); setColor(idn.color); }}
                  className="chip"
                  style={{
                    background: identityId === idn.id ? idn.color : "color-mix(in srgb, var(--label) 6%, transparent)",
                    color: identityId === idn.id ? "#fff" : "var(--label)",
                  }}
                >
                  <span className="inline-flex items-center gap-1.5"><AppIcon name={idn.emoji} size={15} /> {idn.name}</span>
                </button>
              ))}
            </div>
          </Field>
        )}

        <Field label="نشانه: کِی و کجا؟ (اختیاری)">
          <input className="ios-input" value={cue} onChange={(e) => setCue(e.target.value)} placeholder="مثلاً بعد از بیدار شدن، کنار تخت" />
        </Field>
        <Field label="نسخه‌ی ۲ دقیقه‌ای (اختیاری)">
          <input className="ios-input" value={minVersion} onChange={(e) => setMinVersion(e.target.value)} placeholder="حتی روزهای بد هم شدنیه: مثلاً یک لیوان آب" />
        </Field>

        <Field label="آیکون">
          <div className="flex flex-wrap gap-2">
            {HABIT_ICONS.map((e) => (
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
          {busy && <Spinner />} ساخت عادت
        </Button>
      </div>
    </Sheet>
  );
}
