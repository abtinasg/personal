"use client";

import { useState } from "react";
import type { Tab } from "@/lib/types";
import { Card, SectionTitle } from "@/components/ui";
import { AppIcon } from "@/components/AppIcon";
import WeeklyReview from "@/components/WeeklyReview";

const LINKS: { key: Tab; icon: string; title: string; sub: string; color: string }[] = [
  { key: "identities", icon: "star", title: "هویت‌ها", sub: "آدمی که داری می‌شی", color: "#8267f2" },
  { key: "calorie", icon: "flame", title: "کالری‌شمار", sub: "تغذیه و وعده‌های امروز", color: "#fb9a5b" },
  { key: "budget", icon: "wallet", title: "بودجه و خرج", sub: "درآمد، هزینه و پس‌انداز", color: "#5b76f0" },
];

export default function MoreView({ onGoto }: { onGoto: (t: Tab) => void }) {
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  return (
    <div className="space-y-3">
      <SectionTitle>هوش مصنوعی</SectionTitle>
      <button
        onClick={() => setWeeklyOpen(true)}
        className="w-full text-right rounded-3xl p-4 text-white shadow-card active:scale-[0.98] transition flex items-center gap-3"
        style={{ backgroundImage: "linear-gradient(135deg, #5b76f0, #8267f2)" }}
      >
        <span className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0"><AppIcon name="chart" size={24} /></span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[17px]">مرورِ هفتگیِ هوشمند</p>
          <p className="text-[13px] opacity-90">الگوهای هفته‌ات + یک قدمِ بعدی</p>
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 rotate-180 opacity-90">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>

      <button
        onClick={() => onGoto("workout")}
        className="w-full text-right rounded-3xl p-4 text-white shadow-card active:scale-[0.98] transition flex items-center gap-3"
        style={{ backgroundImage: "linear-gradient(135deg, #5b76f0, #2cb8cf)" }}
      >
        <span className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0"><AppIcon name="strength" size={24} /></span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[17px]">برنامه‌ی ورزشی</p>
          <p className="text-[13px] opacity-90">تمرینِ هوازی و قدرتیِ امروزت با مربیِ هوشمند</p>
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 rotate-180 opacity-90">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>

      <SectionTitle>انگیزه</SectionTitle>
      <button
        onClick={() => onGoto("rewards")}
        className="w-full text-right rounded-3xl p-4 text-white shadow-card active:scale-[0.98] transition flex items-center gap-3"
        style={{ backgroundImage: "linear-gradient(135deg, #fb9a5b, #fb7fa0)" }}
      >
        <span className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0"><AppIcon name="gift" size={24} /></span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[17px]">جایزه‌ها</p>
          <p className="text-[13px] opacity-90">با روزهای پیاپیِ عالی، جایزه‌های باحال برای خودت باز کن</p>
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 rotate-180 opacity-90">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>

      <SectionTitle>بیشتر</SectionTitle>
      <div className="space-y-3">
        {LINKS.map((l) => (
          <Card key={l.key} onClick={() => onGoto(l.key)} className="flex items-center gap-3">
            <span className="h-12 w-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: l.color + "22", color: l.color }}>
              <AppIcon name={l.icon} size={24} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[17px]">{l.title}</p>
              <p className="secondary text-[13px]">{l.sub}</p>
            </div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--secondary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 rotate-180">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Card>
        ))}
      </div>

      <WeeklyReview open={weeklyOpen} onClose={() => setWeeklyOpen(false)} />
    </div>
  );
}
