"use client";

import { ReactNode, useEffect } from "react";
import { AppIcon } from "@/components/AppIcon";

export function Card({
  children,
  className = "",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`card p-5 ${onClick ? "active:scale-[0.99] transition cursor-pointer" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between px-1 mb-2 mt-6">
      <h2 className="text-[22px] font-bold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}

/** حلقه‌ی پیشرفت به سبک اپل. */
export function Ring({
  progress,
  size = 120,
  stroke = 12,
  color = "#22c391",
  track = "rgba(120,110,200,0.14)",
  children,
}: {
  progress: number; // 0..1 (می‌تواند بیشتر از ۱ شود)
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: {
  children: ReactNode;
  variant?: "primary" | "ghost";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`${variant === "primary" ? "ios-btn-primary" : "ios-btn-ghost"} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[13px] secondary mb-1.5 block px-1">{label}</span>
      {children}
    </label>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-[#1a1430]/30 backdrop-blur-md animate-[fade-up_0.2s_ease]" onClick={onClose} />
      <div className="glass-strong relative w-full sm:max-w-md rounded-t-[34px] sm:rounded-[36px] shadow-float border border-[var(--border)] animate-sheet-up max-h-[92vh] overflow-y-auto pb-[max(20px,env(safe-area-inset-bottom))]">
        <div className="sticky top-0 glass-strong z-10 flex items-center justify-between px-5 pt-4 pb-3">
          <div className="absolute top-2 left-1/2 -translate-x-1/2 h-1.5 w-10 rounded-full bg-[var(--label)]/15" />
          <h3 className="text-[20px] font-bold mt-2">{title}</h3>
          <button onClick={onClose} className="mt-2 text-ios-blue text-[17px] font-medium active:opacity-60">
            بستن
          </button>
        </div>
        <div className="px-5 pt-1">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      <div className="mb-3 h-16 w-16 rounded-[22px] glass border border-[var(--border)] shadow-soft flex items-center justify-center text-[var(--secondary)]">
        <AppIcon name={icon} size={30} />
      </div>
      <p className="text-[17px] font-semibold">{title}</p>
      {sub && <p className="secondary text-[15px] mt-1">{sub}</p>}
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <div
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-[18px] bg-[var(--label)]/[0.05] p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-[14px] py-2 text-[14px] font-semibold transition ${
            value === o.value ? "bg-[var(--card-solid)] shadow-soft" : "secondary"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
