"use client";

import { useEffect, useState } from "react";
import { apiGet, ApiError } from "@/lib/client";
import { fa, money } from "@/lib/format";
import { Sheet, EmptyState } from "@/components/ui";
import { AppIcon } from "@/components/AppIcon";
import { AiError } from "@/components/AiError";
import { AiThinking } from "@/components/AiThinking";
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
  const [statsLoading, setStatsLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [statsErr, setStatsErr] = useState<unknown>(null);
  const [hasData, setHasData] = useState<boolean | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [reviewFailed, setReviewFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;

    setStatsLoading(true);
    setReviewLoading(false);
    setStatsErr(null);
    setHasData(null);
    setStats(null);
    setReview(null);
    setReviewFailed(false);

    // Phase 1: آمار سریع از DB — بدون فراخوانیِ AI
    apiGet<Resp>("/api/coach/weekly?quick=1")
      .then((r) => {
        if (!alive) return;
        setHasData(r.hasData);
        if (r.stats) setStats(r.stats);

        // اگر cache کامل بود (review هم آمد)، phase 2 لازم نیست
        if (r.review) { setReview(r.review); return; }
        if (!r.hasData) return;

        // Phase 2: تحلیلِ AI — روی آمارِ نمایش‌داده‌شده بارگذاری می‌شود
        setReviewLoading(true);
        apiGet<Resp>("/api/coach/weekly")
          .then((r2) => { if (alive && r2.review) setReview(r2.review); })
          .catch(() => { if (alive) setReviewFailed(true); })
          .finally(() => { if (alive) setReviewLoading(false); });
      })
      .catch((e) => {
        if (alive) setStatsErr(e instanceof ApiError ? e : new Error("خطا در دریافتِ مرور."));
      })
      .finally(() => { if (alive) setStatsLoading(false); });

    return () => { alive = false; };
  }, [open]);

  return (
    <Sheet open={open} onClose={onClose} title="مرورِ هفتگیِ هوشمند">
      {/* Phase 1: بارگذاریِ اولیه */}
      {statsLoading && (
        <AiThinking messages={["دارم آمار هفته‌ات رو می‌کِشم…"]} />
      )}

      {!statsLoading && <AiError error={statsErr} className="py-4" />}

      {!statsLoading && !statsErr && hasData === false && (
        <EmptyState icon="chart" title="هنوز داده‌ای برای مرور نیست" sub="چند روز که عادت، کالری یا خرجت رو ثبت کنی، اینجا یک مرورِ کامل می‌گیری." />
      )}

      {!statsLoading && !statsErr && hasData && stats && (
        <div className="space-y-4">
          {/* آمارِ هفته — فوری نشان داده می‌شود */}
          <div className="grid grid-cols-2 gap-2.5">
            <Stat label="رأی این هفته" value={fa(stats.votesThisWeek)} sub={`${fa(stats.habitRate)}٪ از عادت‌ها`} />
            <Stat label="میانگین کالری" value={stats.calDaysLogged ? fa(stats.calAvg) : "—"} sub={`هدف ${fa(stats.calGoal)}`} />
            <Stat label="خرجِ هفته" value={stats.expenseTotal ? money(stats.expenseTotal) : "—"} sub={stats.topCategory ? `بیشتر: ${stats.topCategory.name}` : ""} />
            <Stat label="حال‌وهوا" value={stats.moodAvg != null ? `${fa(stats.moodAvg, 1)} / ۵` : "—"} sub={stats.moodDays ? `${fa(stats.moodDays)} روز` : ""} />
          </div>

          {/* Phase 2: تحلیلِ AI */}
          {reviewLoading && (
            <AiThinking messages={["دارم هفته‌ات رو تحلیل می‌کنم…", "الگوهای رفتاری رو بررسی می‌کنم…", "دارم توصیه می‌نویسم…", "نزدیکه…"]} />
          )}

          {!reviewLoading && reviewFailed && (
            <p className="secondary text-[13px] text-center py-3">تحلیلِ هوشمند در این لحظه در دسترس نیست.</p>
          )}

          {!reviewLoading && review && (
            <>
              <div>
                <p className="text-[20px] font-extrabold leading-snug grad-text">{review.headline}</p>
                <p className="text-[15px] leading-7 mt-2">{review.narrative}</p>
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
            </>
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
