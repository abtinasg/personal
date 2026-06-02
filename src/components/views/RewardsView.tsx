"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/client";
import { fa } from "@/lib/format";
import type { Reward } from "@/lib/types";
import { Card, Sheet, Field, Button, Spinner, EmptyState, SectionTitle, useConfirm } from "@/components/ui";
import { AddButton } from "@/components/views/CaloriesView";
import { AppIcon } from "@/components/AppIcon";

const REWARD_ICONS = ["gift", "trophy", "star", "sparkles", "fun", "celebrate", "heart", "sun", "rocket"];
const COLORS = ["#fb9a5b", "#fb7fa0", "#a96ff0", "#8267f2", "#5b76f0", "#2cb8cf", "#22c391"];
const DAY_OPTIONS = [3, 5, 7, 14, 21, 30];

// پیشنهادهای آماده — هیجان‌انگیز و غیرخوراکی (نه «برو غذا بخور»).
const PRESETS: { title: string; emoji: string; color: string; days: number }[] = [
  { title: "یه قسمت از سریالِ موردعلاقه‌ت", emoji: "fun", color: "#a96ff0", days: 3 },
  { title: "یه آهنگِ جدید یا پلی‌لیستِ تازه", emoji: "sparkles", color: "#fb7fa0", days: 3 },
  { title: "یه ساعت بازی بدونِ عذابِ وجدان", emoji: "celebrate", color: "#8267f2", days: 5 },
  { title: "خریدِ یه چیزِ کوچیکِ دلخواه", emoji: "gift", color: "#fb9a5b", days: 7 },
  { title: "یه فیلم تو سینما", emoji: "trophy", color: "#5b76f0", days: 7 },
  { title: "یه روزِ کاملِ استراحت و تفریح", emoji: "star", color: "#22c391", days: 14 },
];

export default function RewardsView() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [justClaimed, setJustClaimed] = useState<Reward | null>(null);
  const { confirm, dialog } = useConfirm();

  const load = useCallback(async () => {
    const { streak, rewards } = await apiGet<{ streak: number; rewards: Reward[] }>("/api/rewards");
    setStreak(streak);
    setRewards(rewards);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function claim(r: Reward) {
    setClaiming(r.id);
    try {
      await apiSend("/api/rewards/claim", "POST", { rewardId: r.id });
      setJustClaimed(r);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "نشد جایزه رو بگیری.");
    } finally {
      setClaiming(null);
    }
  }

  async function remove(r: Reward) {
    if (!(await confirm({ title: "حذف جایزه", message: `«${r.title}» حذف شود؟`, confirmLabel: "حذف", danger: true }))) return;
    setRewards((rs) => rs.filter((x) => x.id !== r.id));
    await apiSend(`/api/rewards?id=${r.id}`, "DELETE");
  }

  return (
    <div className="space-y-3">
      <SectionTitle
        action={
          <div className="flex items-center gap-3">
            {rewards.length > 0 && (
              <button onClick={() => setEdit((e) => !e)} className="text-ios-blue text-[15px] font-medium">
                {edit ? "تمام" : "ویرایش"}
              </button>
            )}
            <AddButton onClick={() => setOpen(true)} />
          </div>
        }
      >
        جایزه‌ها
      </SectionTitle>

      {/* استریکِ روزهای پیاپیِ عالی */}
      <Card className="flex items-center gap-4 !p-5">
        <div
          className="h-[72px] w-[72px] rounded-[22px] flex items-center justify-center shrink-0 shadow-card"
          style={{ backgroundImage: "linear-gradient(135deg, #fb9a5b, #fb7fa0)" }}
        >
          <AppIcon name="flame" size={36} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[30px] font-extrabold leading-none">
            {fa(streak)} <span className="text-[16px] font-bold secondary">روزِ پیاپیِ عالی</span>
          </p>
          <p className="secondary text-[13px] mt-1.5 leading-6">
            {streak > 0
              ? "هر روزی که همه‌ی عادت‌هات رو بزنی، استریکت می‌چرخه. نذار بشکنه!"
              : "روزی که همه‌ی عادت‌هات رو کامل بزنی، استریکت شروع می‌شه."}
          </p>
        </div>
      </Card>

      {/* بنرِ جشن بعد از دریافت */}
      {justClaimed && (
        <div
          className="rounded-3xl p-4 text-white shadow-card flex items-center gap-3 animate-scale-in"
          style={{ backgroundImage: `linear-gradient(135deg, ${justClaimed.color}, ${justClaimed.color}bb)` }}
        >
          <span className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <AppIcon name="celebrate" size={26} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-extrabold text-[17px]">جایزه‌ات مالِ خودته!</p>
            <p className="text-[14px] opacity-90 leading-6">برو حالشو ببر: {justClaimed.title}</p>
          </div>
          <button onClick={() => setJustClaimed(null)} className="text-white/90 text-[15px] font-semibold active:opacity-60">
            باشه
          </button>
        </div>
      )}

      {loading ? (
        <Card className="flex justify-center py-8"><Spinner /></Card>
      ) : rewards.length === 0 ? (
        <Card><EmptyState icon="gift" title="هنوز جایزه‌ای نساختی" sub="با + یه جایزه‌ی باحال برای خودت تعریف کن" /></Card>
      ) : (
        <div className="space-y-3">
          {rewards.map((r) => {
            const progress = Math.min(1, r.streak_days ? streak / r.streak_days : 0);
            const remaining = Math.max(0, r.streak_days - streak);
            return (
              <Card key={r.id} className="flex items-center gap-3">
                <span
                  className="h-12 w-12 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: r.color + "22", color: r.color }}
                >
                  <AppIcon name={r.emoji} size={24} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[16px] truncate">{r.title}</p>
                  <p className="secondary text-[12.5px] mt-0.5 flex items-center gap-1">
                    <AppIcon name="flame" size={13} /> با {fa(r.streak_days)} روزِ پیاپیِ عالی
                    {r.total_claims > 0 && <span className="secondary"> · {fa(r.total_claims)} بار گرفتی</span>}
                  </p>
                  {!r.claimable && !r.claimed_in_streak && (
                    <div className="track mt-2 !h-2">
                      <div className="h-full rounded-full transition-all" style={{ width: `${progress * 100}%`, background: r.color }} />
                    </div>
                  )}
                </div>

                {edit ? (
                  <button onClick={() => remove(r)} className="text-ios-red text-[15px] font-medium px-2 shrink-0">حذف</button>
                ) : r.claimable ? (
                  <button
                    onClick={() => claim(r)}
                    disabled={claiming === r.id}
                    className="shrink-0 rounded-2xl px-4 py-2.5 text-white font-bold text-[14px] flex items-center gap-1.5 active:scale-95 transition disabled:opacity-60 shadow-card"
                    style={{ backgroundImage: `linear-gradient(135deg, ${r.color}, ${r.color}bb)` }}
                  >
                    {claiming === r.id ? <Spinner className="!h-4 !w-4" /> : <AppIcon name="gift" size={16} />}
                    دریافت کن
                  </button>
                ) : r.claimed_in_streak ? (
                  <span className="shrink-0 inline-flex items-center gap-1 text-ios-green text-[13px] font-bold px-2">
                    <AppIcon name="check" size={16} /> گرفتی
                  </span>
                ) : (
                  <span className="shrink-0 text-center px-1">
                    <span className="block text-[18px] font-extrabold leading-none" style={{ color: r.color }}>{fa(remaining)}</span>
                    <span className="secondary text-[11px]">روز دیگه</span>
                  </span>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <AddRewardSheet open={open} onClose={() => setOpen(false)} onAdded={load} />
      {dialog}
    </div>
  );
}

function AddRewardSheet({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState(REWARD_ICONS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [days, setDays] = useState(5);
  const [busy, setBusy] = useState(false);

  function reset() {
    setTitle(""); setEmoji(REWARD_ICONS[0]); setColor(COLORS[0]); setDays(5);
  }

  async function submit() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await apiSend("/api/rewards", "POST", { title, emoji, color, streak_days: days });
      reset();
      onAdded();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="جایزه‌ی جدید">
      <div className="space-y-4">
        <div>
          <span className="text-[13px] secondary mb-1.5 block px-1">یه چیزِ باحال انتخاب کن یا خودت بنویس</span>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.title}
                onClick={() => { setTitle(p.title); setEmoji(p.emoji); setColor(p.color); setDays(p.days); }}
                className="chip !text-[13px] active:opacity-60 transition inline-flex items-center gap-1.5"
                style={{ background: p.color + "1f", color: p.color }}
              >
                <AppIcon name={p.emoji} size={15} /> {p.title}
              </button>
            ))}
          </div>
        </div>

        <Field label="جایزه‌ات چیه؟">
          <input className="ios-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً یه آهنگِ جدید گوش بدم" autoFocus />
        </Field>

        <Field label="بعد از چند روزِ پیاپیِ عالی باز شه؟">
          <div className="flex flex-wrap gap-2">
            {DAY_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className="chip !text-[14px]"
                style={{
                  background: days === d ? color : "color-mix(in srgb, var(--label) 6%, transparent)",
                  color: days === d ? "#fff" : "var(--label)",
                }}
              >
                {fa(d)} روز
              </button>
            ))}
          </div>
        </Field>

        <Field label="آیکون">
          <div className="flex flex-wrap gap-2">
            {REWARD_ICONS.map((e) => (
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

        <Button onClick={submit} disabled={busy || !title.trim()} className="w-full flex items-center justify-center gap-2">
          {busy && <Spinner />} ساخت جایزه
        </Button>
      </div>
    </Sheet>
  );
}
