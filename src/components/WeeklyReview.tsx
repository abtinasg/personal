"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/client";
import { fa, money } from "@/lib/format";
import { Sheet, Spinner, EmptyState } from "@/components/ui";
import { AppIcon } from "@/components/AppIcon";
import type { WeeklyReview as Review } from "@/app/api/coach/weekly/route";

type Stats = {
  habitRate: number;
  habitDone: number;
  habitPossible: number;
  bestStreakIdentity: string | null;
  votesThisWeek: number;
  calAvg: number;
  calGoal: number;
  calDaysLogged: number;
  expenseTotal: number;
  topCategory: { name: string; amount: number } | null;
  moodAvg: number | null;
  moodDays: number;
  activeMission: string | null;
};

type Resp = { hasData: boolean; stats?: Stats; review?: Review };

export default function WeeklyReview({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState<Resp | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setErr("");
    setData(null);
    apiGet<Resp>("/api/coach/weekly")
      .then((r) => { if (alive) setData(r); })
      .catch((e) => { if (alive) setErr(e instanceof Error ? e.message : "خطا در تهیه‌ی مرور."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [open]);

  const stats = data?.stats;
  const review = data?.review;

  return (
    <Sheet open={open} onClose={onClose} title="مرورِ هفتگیِ هوشمند">
      {loading && (
        <div className="flex flex-col items-center justify-center py-14 gap-3">
          <Spinner className="!h-7 !w-7" />
          <p className="secondary text-[14px]">دارم هفته‌ات رو مرور می‌کنم…</p>
        </div>
      )}

      {err && !loading && <p className="text-ios-red text-[14px] py-4">{err}</p>}

      {!loading && !err && data && !data.hasData && (
        <EmptyState icon="chart" title="هنوز داده‌ای برای مرور نیست" sub="چند روز که عادت، کالری یا خرجت رو ثبت کنی، اینجا یک مرورِ کامل می‌گیری." />
      )}

      {!loading && !err && review && stats && (
        <div className="space-y-4">
          <div>
            <p className="text-[20px] font-extrabold leading-snug grad-text">{review.headline}</p>
            <p className="text-[15px] leading-7 mt-2">{review.narrative}</p>
          </div>

          {/* آمارِ هفته */}
          <div className="grid grid-cols-2 gap-2.5">
            <Stat label="رأی این هفته" value={fa(stats.votesThisWeek)} sub={`${fa(stats.habitRate)}٪ از عادت‌ها`} />
            <Stat label="میانگین کالری" value={stats.calDaysLogged ? fa(stats.calAvg) : "—"} sub={`هدف ${fa(stats.calGoal)}`} />
            <Stat label="خرجِ هفته" value={stats.expenseTotal ? money(stats.expenseTotal) : "—"} sub={stats.topCategory ? `بیشتر: ${stats.topCategory.name}` : ""} />
            <Stat label="حال‌وهوا" value={stats.moodAvg != null ? `${fa(stats.moodAvg, 1)} / ۵` : "—"} sub={stats.moodDays ? `${fa(stats.moodDays)} روز` : ""} />
          </div>

          {review.wins.length > 0 && (
            <div className="card !p-4">
              <p className="font-bold text-[15px] mb-2 flex items-center gap-1.5"><span className="text-ios-yellow"><AppIcon name="trophy" size={17} /></span> بُردهای هفته</p>
              <ul className="space-y-1.5">
                {review.wins.map((w, i) => (
                  <li key={i} className="text-[14px] flex gap-2">
                    <span className="text-ios-green shrink-0 mt-0.5"><AppIcon name="check" size={15} /></span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {review.focus && (
            <div className="card !p-4" style={{ background: "var(--ios-blue,#1f6ca6)11" }}>
              <p className="font-bold text-[15px] mb-1 flex items-center gap-1.5"><span className="text-ios-blue"><AppIcon name="target" size={17} /></span> تمرکزِ هفته‌ی بعد</p>
              <p className="text-[14px] leading-7">{review.focus}</p>
            </div>
          )}

          {review.suggestion && (
            <div className="rounded-2xl p-4 text-white" style={{ backgroundImage: "linear-gradient(135deg, #1f6ca6, #16517d)" }}>
              <p className="font-bold text-[15px] mb-1 flex items-center gap-1.5"><AppIcon name="idea" size={17} /> یک قدمِ کوچک</p>
              <p className="text-[14px] leading-7 opacity-95">{review.suggestion}</p>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card !p-3.5">
      <p className="secondary text-[12px]">{label}</p>
      <p className="text-[19px] font-extrabold leading-tight mt-0.5">{value}</p>
      {sub && <p className="secondary text-[11px] mt-0.5 truncate">{sub}</p>}
    </div>
  );
}
