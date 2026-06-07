"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiGet } from "@/lib/client";
import { Card, SectionTitle, Skeleton, Chevron } from "@/components/ui";
import { AppIcon } from "@/components/AppIcon";
import CoachChat from "@/components/CoachChat";
import WeeklyReview from "@/components/WeeklyReview";
import WorkoutView from "@/components/views/WorkoutView";

export default function CoachPage() {
  const [briefing, setBriefing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const [view, setView] = useState<"hub" | "workout">("hub");
  const params = useSearchParams();

  // ورودِ مهمان مستقیم به لحظه‌ی آها: /coach?chat=1 گفتگو با جوانه را باز می‌کند.
  useEffect(() => {
    if (params.get("chat") === "1") setChatOpen(true);
  }, [params]);

  useEffect(() => {
    let alive = true;
    apiGet<{ briefing: string }>("/api/coach/briefing")
      .then((r) => {
        if (alive) setBriefing(r.briefing);
      })
      .catch(() => {
        /* بریفینگ اختیاریه */
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (view === "workout") {
    return (
      <div className="space-y-3">
        <button
          onClick={() => setView("hub")}
          className="flex items-center gap-1.5 mt-2 text-ios-blue active:opacity-60 transition"
        >
          <Chevron dir="back" size={22} />
          <span className="text-[16px] font-semibold">مربی</span>
        </button>
        <WorkoutView />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* بریفینگِ امروز */}
      <SectionTitle>بریفینگِ امروز</SectionTitle>
      {loading ? (
        <Card className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </Card>
      ) : (
        <Card className="flex gap-3 items-start">
          <span className="text-ios-blue mt-0.5 shrink-0">
            <AppIcon name="compass" size={22} />
          </span>
          <p className="text-[15px] leading-7 flex-1">
            {briefing || "امروز رو با یک قدمِ کوچیک شروع کن. هر وقت خواستی، باهام حرف بزن."}
          </p>
        </Card>
      )}

      <SectionTitle>با مربی کار کن</SectionTitle>

      <HubRow
        icon="sparkles"
        title="گفت‌وگو با مربی"
        sub="هر سؤالی داری بپرس؛ بر اساسِ داده‌های خودت جواب می‌گیری"
        gradient="linear-gradient(135deg, #16517d, #1f6ca6)"
        onClick={() => setChatOpen(true)}
      />
      <HubRow
        icon="chart"
        title="مرورِ هفتگیِ هوشمند"
        sub="الگوهای هفته‌ات + یک قدمِ بعدی"
        gradient="linear-gradient(135deg, #1f6ca6, #3aa6b8)"
        onClick={() => setWeeklyOpen(true)}
      />
      <HubRow
        icon="strength"
        title="برنامه‌ی ورزشی"
        sub="تمرینِ هوازی و قدرتیِ امروزت با مربیِ هوشمند"
        gradient="linear-gradient(135deg, #ef9d63, #f08197)"
        onClick={() => setView("workout")}
      />

      <CoachChat open={chatOpen} onClose={() => setChatOpen(false)} />
      <WeeklyReview open={weeklyOpen} onClose={() => setWeeklyOpen(false)} />
    </div>
  );
}

function HubRow({
  icon,
  title,
  sub,
  gradient,
  onClick,
}: {
  icon: string;
  title: string;
  sub: string;
  gradient: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-right rounded-3xl p-4 text-white shadow-card active:scale-[0.98] transition flex items-center gap-3"
      style={{ backgroundImage: gradient }}
    >
      <span className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
        <AppIcon name={icon} size={24} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-[17px]">{title}</p>
        <p className="text-[13px] opacity-90">{sub}</p>
      </div>
      <Chevron className="shrink-0 opacity-90" />
    </button>
  );
}
