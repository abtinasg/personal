"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiSend } from "@/lib/client";
import { fa, todayISO, jDateShort } from "@/lib/format";
import type { Habit, HabitLog, Mission } from "@/lib/types";
import type { MissionPlan } from "@/app/api/missions/generate/route";
import { Card, Sheet, Field, Button, Spinner, EmptyState, SectionTitle, useConfirm } from "@/components/ui";
import { AppIcon } from "@/components/AppIcon";

function daysLeft(end_on: string | null): number | null {
  if (!end_on) return null;
  const end = new Date(end_on + "T00:00:00").getTime();
  const now = new Date(todayISO() + "T00:00:00").getTime();
  return Math.round((end - now) / 86400000);
}

export default function MissionsView() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const { confirm, dialog } = useConfirm();
  const today = todayISO();

  const load = useCallback(async () => {
    const [{ missions }, { habits, logs }] = await Promise.all([
      apiGet<{ missions: Mission[] }>("/api/missions"),
      apiGet<{ habits: Habit[]; logs: HabitLog[] }>(`/api/habits?from=${today}`),
    ]);
    setMissions(missions);
    setHabits(habits);
    setLogs(logs || []);
    setLoading(false);
  }, [today]);

  useEffect(() => {
    load();
  }, [load]);

  const habitById = useMemo(() => new Map(habits.map((h) => [h.id, h])), [habits]);
  const doneToday = useMemo(() => new Set(logs.filter((l) => l.done_on === today).map((l) => l.habit_id)), [logs, today]);

  async function toggleMilestone(missionId: string, milestoneId: string, reached: boolean) {
    setMissions((ms) =>
      ms.map((m) =>
        m.id !== missionId
          ? m
          : {
              ...m,
              milestones: m.milestones.map((ms2) =>
                ms2.id === milestoneId ? { ...ms2, reached_at: reached ? new Date().toISOString() : null } : ms2
              ),
            }
      )
    );
    await apiSend("/api/missions", "PUT", { milestoneId, reached });
  }

  async function setStatus(missionId: string, status: Mission["status"]) {
    setMissions((ms) => ms.map((m) => (m.id === missionId ? { ...m, status } : m)));
    await apiSend("/api/missions", "PUT", { id: missionId, status });
  }

  async function remove(m: Mission) {
    if (!(await confirm({ title: "حذف ماموریت", message: `«${m.title}» برای همیشه حذف شود؟`, confirmLabel: "حذف", danger: true }))) return;
    setMissions((ms) => ms.filter((x) => x.id !== m.id));
    await apiSend(`/api/missions?id=${m.id}`, "DELETE");
  }

  const active = missions.filter((m) => m.status === "active");
  const completed = missions.filter((m) => m.status === "completed");

  return (
    <div className="space-y-3">
      <SectionTitle
        action={
          missions.length > 0 ? (
            <button onClick={() => setEdit((e) => !e)} className="text-ios-blue text-[15px] font-medium">
              {edit ? "تمام" : "ویرایش"}
            </button>
          ) : undefined
        }
      >
        ماموریت‌ها
      </SectionTitle>

      <Card
        onClick={() => setOpen(true)}
        className="!p-0 overflow-hidden text-white relative"
      >
        <div className="p-5" style={{ backgroundImage: "linear-gradient(135deg, #8267f2, #5b76f0 60%, #2cb8cf)" }}>
          <div className="flex items-center gap-3">
            <span className="shrink-0"><AppIcon name="sparkles" size={32} /></span>
            <div className="flex-1">
              <p className="font-extrabold text-[19px] leading-tight">ماموریت تازه بساز</p>
              <p className="text-white/85 text-[13px] mt-1">
                هدفت رو بگو تا مربی هوشمند، هویت و عادت‌ها و نقشه‌ی راهت رو طراحی کنه
              </p>
            </div>
          </div>
        </div>
      </Card>

      {loading ? (
        <Card className="flex justify-center py-8"><Spinner /></Card>
      ) : active.length === 0 ? (
        <Card><EmptyState icon="rocket" title="هنوز ماموریتی نداری" sub="با دکمه‌ی بالا اولین ماموریتت رو بساز" /></Card>
      ) : (
        <div className="space-y-3">
          {active.map((m) => {
            const reached = m.milestones.filter((x) => x.reached_at).length;
            const total = m.milestones.length;
            const prog = total ? reached / total : 0;
            const dleft = daysLeft(m.end_on);
            const linked = m.habit_ids.map((id) => habitById.get(id)).filter(Boolean) as Habit[];
            const doneCount = linked.filter((h) => doneToday.has(h.id)).length;
            return (
              <Card key={m.id} className="!p-0 overflow-hidden">
                <div className="h-1.5" style={{ background: m.color }} />
                <div className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="shrink-0 mt-0.5" style={{ color: m.color }}><AppIcon name={m.emoji} size={28} /></span>
                    <div className="flex-1 min-w-0">
                      <p className="font-extrabold text-[18px] leading-tight">{m.title}</p>
                      {m.why && <p className="secondary text-[13px] mt-1 leading-relaxed">{m.why}</p>}
                    </div>
                    {dleft != null && (
                      <div className="text-center shrink-0">
                        <p className="font-extrabold text-[18px] leading-none" style={{ color: m.color }}>{fa(Math.max(0, dleft))}</p>
                        <p className="secondary text-[10px] mt-0.5">روز مانده</p>
                      </div>
                    )}
                  </div>

                  {m.target_label && m.target_value != null && (
                    <div className="chip inline-flex items-center gap-1.5" style={{ background: m.color + "1a", color: m.color }}>
                      <AppIcon name="target" size={14} /> {m.target_label}: {fa(m.target_value)} {m.target_unit || ""}
                    </div>
                  )}

                  {total > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[13px] font-semibold">نقطه‌عطف‌ها</p>
                        <p className="secondary text-[12px]">{fa(reached)} از {fa(total)}</p>
                      </div>
                      <div className="track mb-2.5">
                        <div className="h-full rounded-full transition-all" style={{ width: `${prog * 100}%`, background: m.color }} />
                      </div>
                      <div className="space-y-1">
                        {m.milestones.map((ms) => {
                          const done = !!ms.reached_at;
                          return (
                            <button
                              key={ms.id}
                              onClick={() => toggleMilestone(m.id, ms.id, !done)}
                              className="flex items-center gap-2.5 w-full text-right py-1.5 active:opacity-60 transition"
                            >
                              <span
                                className="h-5 w-5 rounded-full shrink-0 flex items-center justify-center"
                                style={{ background: done ? m.color : "transparent", border: done ? "none" : "2px solid var(--sep)" }}
                              >
                                {done && (
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="m5 12 4.5 4.5L19 7" />
                                  </svg>
                                )}
                              </span>
                              <span className={`text-[14px] ${done ? "line-through secondary" : ""}`}>{ms.title}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {linked.length > 0 && (
                    <div className="pt-1">
                      <p className="text-[13px] font-semibold mb-1.5">
                        عادت‌های روزانه <span className="secondary font-normal">· امروز {fa(doneCount)} از {fa(linked.length)}</span>
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {linked.map((h) => {
                          const d = doneToday.has(h.id);
                          return (
                            <span
                              key={h.id}
                              className="chip inline-flex items-center gap-1.5"
                              style={{ background: d ? h.color : "color-mix(in srgb, var(--label) 6%, transparent)", color: d ? "#fff" : "var(--label)" }}
                            >
                              <AppIcon name={h.emoji} size={14} /> {h.name}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {m.end_on && (
                    <p className="secondary text-[11px] pt-1">تا {jDateShort(m.end_on)}</p>
                  )}

                  {total > 0 && reached === total && (
                    <div className="rounded-2xl p-3 text-center" style={{ background: m.color + "1a" }}>
                      <p className="font-bold text-[14px] inline-flex items-center gap-1.5" style={{ color: m.color }}><AppIcon name="celebrate" size={16} /> همه‌ی نقطه‌عطف‌ها رسید — آماده‌ی تکمیله!</p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    {edit ? (
                      <>
                        <button onClick={() => setStatus(m.id, "abandoned")} className="flex-1 ios-btn-ghost !py-2.5 !text-[14px]">رهاش کن</button>
                        <button onClick={() => remove(m)} className="flex-1 ios-btn-ghost !py-2.5 !text-[14px] text-ios-red">حذف</button>
                      </>
                    ) : (
                      <button
                        onClick={() => setStatus(m.id, "completed")}
                        className="w-full ios-btn !py-2.5 !text-[15px] text-white inline-flex items-center justify-center gap-2"
                        style={{ background: m.color }}
                      >
                        تکمیل ماموریت <AppIcon name="celebrate" size={17} />
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {completed.length > 0 && (
        <>
          <p className="font-bold text-[15px] px-1 pt-3 secondary inline-flex items-center gap-1.5"><AppIcon name="trophy" size={16} /> ماموریت‌های تکمیل‌شده</p>
          <div className="grid grid-cols-2 gap-3">
            {completed.map((m) => (
              <Card key={m.id} className="!p-4 flex items-center gap-3">
                <span className="shrink-0" style={{ color: m.color }}><AppIcon name={m.emoji} size={26} /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[14px] truncate">{m.title}</p>
                  <p className="text-[12px]" style={{ color: m.color }}>تکمیل شد</p>
                </div>
                {edit && (
                  <button onClick={() => remove(m)} className="text-ios-red text-[13px] shrink-0">حذف</button>
                )}
              </Card>
            ))}
          </div>
        </>
      )}

      <MissionCreatorSheet open={open} onClose={() => setOpen(false)} onDone={load} />
      {dialog}
    </div>
  );
}

function MissionCreatorSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [goal, setGoal] = useState("");
  const [plan, setPlan] = useState<MissionPlan | null>(null);
  const [phase, setPhase] = useState<"input" | "review">("input");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function reset() {
    setGoal(""); setPlan(null); setPhase("input"); setErr(null); setBusy(false);
  }
  function close() {
    reset();
    onClose();
  }

  async function generate() {
    if (!goal.trim()) return;
    setBusy(true); setErr(null);
    try {
      const { plan } = await apiSend<{ plan: MissionPlan }>("/api/missions/generate", "POST", { goal });
      setPlan(plan);
      setPhase("review");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "خطا در ساخت ماموریت");
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!plan) return;
    setBusy(true); setErr(null);
    try {
      await apiSend("/api/missions/apply", "POST", { plan });
      onDone();
      close();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "خطا در ذخیره‌ی ماموریت");
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={close} title={phase === "input" ? "ماموریت تازه" : "نقشه‌ی ماموریت"}>
      {phase === "input" ? (
        <div className="space-y-4">
          <Field label="هدفت چیه؟">
            <textarea
              className="ios-input min-h-[120px] resize-none leading-relaxed"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="مثلاً: می‌خوام تا تابستون ۸ کیلو کم کنم و فیت بشم — یا — می‌خوام برای کنکور منظم درس بخونم"
              autoFocus
            />
          </Field>
          <p className="secondary text-[13px] leading-relaxed">
            بر پایه‌ی «عادت‌های اتمی» یک ماموریت با هویت، نقطه‌عطف‌ها و عادت‌های روزانه‌ی کوچک برات طراحی می‌شه. می‌تونی قبل از ساخت ببینیش.
          </p>
          {err && <p className="text-ios-red text-[14px]">{err}</p>}
          <Button onClick={generate} disabled={busy || !goal.trim()} className="w-full flex items-center justify-center gap-2">
            {busy ? <><Spinner /> در حال طراحی…</> : <><AppIcon name="sparkles" size={18} /> طراحی ماموریت</>}
          </Button>
        </div>
      ) : plan ? (
        <PlanReview
          plan={plan}
          onChange={setPlan}
          onBack={() => setPhase("input")}
          onApply={apply}
          busy={busy}
          err={err}
        />
      ) : null}
    </Sheet>
  );
}

function PlanReview({
  plan,
  onChange,
  onBack,
  onApply,
  busy,
  err,
}: {
  plan: MissionPlan;
  onChange: (p: MissionPlan) => void;
  onBack: () => void;
  onApply: () => void;
  busy: boolean;
  err: string | null;
}) {
  return (
    <div className="space-y-4 pb-2">
      <div className="rounded-2xl p-4 text-white" style={{ backgroundImage: `linear-gradient(135deg, ${plan.color}, ${plan.color}cc)` }}>
        <div className="flex items-center gap-2 text-[15px] font-semibold">
          <span><AppIcon name={plan.identity.emoji} size={24} /></span>
          <span>هویت تو</span>
        </div>
        <p className="text-[18px] font-extrabold mt-1">{plan.identity.name}</p>
        {plan.identity.statement && <p className="text-white/90 text-[14px] mt-1 leading-relaxed">«{plan.identity.statement}»</p>}
      </div>

      <Field label="عنوان ماموریت">
        <input className="ios-input" value={plan.title} onChange={(e) => onChange({ ...plan, title: e.target.value })} />
      </Field>
      <Field label="چرا این ماموریت؟">
        <textarea className="ios-input min-h-[70px] resize-none leading-relaxed" value={plan.why} onChange={(e) => onChange({ ...plan, why: e.target.value })} />
      </Field>

      <div className="flex flex-wrap gap-2 text-[13px]">
        <span className="chip inline-flex items-center gap-1.5"><AppIcon name="duration" size={14} /> {fa(plan.duration_days)} روز</span>
        {plan.target_label && plan.target_value != null && (
          <span className="chip inline-flex items-center gap-1.5"><AppIcon name="target" size={14} /> {plan.target_label}: {fa(plan.target_value)} {plan.target_unit || ""}</span>
        )}
      </div>

      {plan.milestones.length > 0 && (
        <div>
          <p className="text-[14px] font-bold mb-2 px-1">نقطه‌عطف‌ها</p>
          <div className="space-y-2">
            {plan.milestones.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-black/[0.05] dark:bg-white/[0.08] flex items-center justify-center text-[12px] font-bold secondary shrink-0">{fa(i + 1)}</span>
                <input
                  className="ios-input !py-2 !text-[15px]"
                  value={m}
                  onChange={(e) => onChange({ ...plan, milestones: plan.milestones.map((x, j) => (j === i ? e.target.value : x)) })}
                />
                <button
                  onClick={() => onChange({ ...plan, milestones: plan.milestones.filter((_, j) => j !== i) })}
                  className="text-ios-red text-[13px] px-1 shrink-0"
                >
                  حذف
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {plan.habits.length > 0 && (
        <div>
          <p className="text-[14px] font-bold mb-2 px-1">عادت‌های روزانه</p>
          <div className="space-y-2">
            {plan.habits.map((h, i) => (
              <div key={i} className="card !p-3 !rounded-2xl">
                <div className="flex items-center gap-2">
                  <span className="shrink-0"><AppIcon name={h.emoji} size={20} /></span>
                  <input
                    className="ios-input !py-1.5 !text-[15px] flex-1"
                    value={h.name}
                    onChange={(e) => onChange({ ...plan, habits: plan.habits.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
                  />
                  <button
                    onClick={() => onChange({ ...plan, habits: plan.habits.filter((_, j) => j !== i) })}
                    className="text-ios-red text-[13px] px-1 shrink-0"
                  >
                    حذف
                  </button>
                </div>
                {(h.cue || h.min_version) && (
                  <div className="mt-2 space-y-1 pr-8">
                    {h.cue && <p className="secondary text-[12px] flex items-center gap-1.5"><AppIcon name="cue" size={13} /> نشانه: {h.cue}</p>}
                    {h.min_version && <p className="secondary text-[12px] flex items-center gap-1.5"><AppIcon name="feather" size={13} /> نسخه‌ی حداقلی: {h.min_version}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {err && <p className="text-ios-red text-[14px]">{err}</p>}

      <div className="flex gap-2 pt-1">
        <Button variant="ghost" onClick={onBack} disabled={busy} className="flex-1">دوباره</Button>
        <Button onClick={onApply} disabled={busy} className="flex-[2] flex items-center justify-center gap-2">
          {busy && <Spinner />} شروع ماموریت
        </Button>
      </div>
    </div>
  );
}
