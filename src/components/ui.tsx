"use client";

import { CSSProperties, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AppIcon } from "@/components/AppIcon";

/**
 * المان‌های overlay (مدال‌ها) را به‌جای جایِ فعلی‌شان مستقیم به <body> می‌بَرد.
 */
function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

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
      className={`card ${onClick ? "active:scale-[0.99] transition cursor-pointer" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between px-1 mb-2 mt-6">
      <h2 className="text-[21px] font-extrabold tracking-tight" style={{ color: "var(--ink)" }}>{children}</h2>
      {action}
    </div>
  );
}

/** حلقه‌ی پیشرفت SVG — linecap round، رنگ‌های پالتِ جدید. */
export function Ring({
  progress,
  size = 120,
  stroke = 12,
  color = "var(--sage)",
  track = "rgba(22,24,31,0.08)",
  children,
}: {
  progress: number;
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

const BTN_VARIANT: Record<string, string> = {
  primary: "ios-btn-primary",
  dark: "ios-btn-primary",
  blue: "ios-btn-blue",
  ghost: "ios-btn-ghost",
};

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: {
  children: ReactNode;
  variant?: "primary" | "dark" | "blue" | "ghost";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`${BTN_VARIANT[variant] ?? "ios-btn-primary"} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/** دکمه‌ی آیکونیِ دایره‌ای — برای هدرها و کنارِ کارت‌ها. */
export function RoundButton({
  icon,
  variant = "light",
  size = 42,
  iconSize = 20,
  className = "",
  ...props
}: {
  icon: string;
  variant?: "light" | "dark" | "blue";
  size?: number;
  iconSize?: number;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles: Record<string, string> = {
    light: "bg-white text-[var(--ink)] shadow-soft",
    dark: "bg-[var(--ink)] text-white",
    blue: "bg-[var(--blue)] text-white",
  };
  return (
    <button
      className={`inline-flex items-center justify-center rounded-full transition active:scale-90 ${styles[variant]} ${className}`}
      style={{ width: size, height: size }}
      {...props}
    >
      <AppIcon name={icon} size={iconSize} />
    </button>
  );
}

/** چیپِ آیکونِ تینت‌دار — مربعِ گوشه‌گردِ رنگی با آیکونِ اکسنت. */
export function IconChip({
  icon,
  color,
  bg,
  size = 42,
  radius = 14,
  iconSize = 20,
}: {
  icon: string;
  color: string;
  bg: string;
  size?: number;
  radius?: number;
  iconSize?: number;
}) {
  return (
    <span className="ichip" style={{ width: size, height: size, borderRadius: radius, background: bg, color, flexShrink: 0 }}>
      <AppIcon name={icon} size={iconSize} />
    </span>
  );
}

/** چیپِ رنگی کوچک. */
export function Chip({
  children,
  color = "var(--blue)",
  solid = false,
  className = "",
}: {
  children: ReactNode;
  color?: string;
  solid?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold ${className}`}
      style={solid ? { background: color, color: "#fff" } : { background: `color-mix(in srgb, ${color} 16%, #fff)`, color }}
    >
      {children}
    </span>
  );
}

/** کاشیِ آمارِ پاستلی (گرید ۲ستونه). */
export function StatTile({
  tint,
  label,
  value,
  sub,
  icon,
  iconColor,
  ring,
  ringColor,
  big = false,
  onClick,
}: {
  tint: string;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: string;
  iconColor?: string;
  ring?: number;
  ringColor?: string;
  big?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`tile ${onClick ? "cursor-pointer transition active:scale-[0.98]" : ""}`}
      style={{ background: tint }}
    >
      <div className="tile-top">
        <span className="t-cap" style={{ color: "rgba(28,31,41,0.6)" }}>{label}</span>
        {icon && (
          <span className="ichip" style={{ width: 32, height: 32, borderRadius: 11, background: "rgba(255,255,255,0.7)", color: iconColor, flexShrink: 0 }}>
            <AppIcon name={icon} size={17} />
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        {ring != null ? (
          <Ring progress={ring} size={46} stroke={6} color={ringColor || iconColor || "var(--blue)"}>
            <span className="num" style={{ fontSize: 13, color: "var(--ink)" }}>{value}</span>
          </Ring>
        ) : (
          <span className="num" style={{ fontSize: big ? 34 : 27, color: "var(--ink)" }}>{value}</span>
        )}
        {sub && !ring && <span className="t-cap" style={{ marginInlineStart: 4 }}>{sub}</span>}
      </div>
      {sub && ring != null && <span className="t-cap" style={{ color: "rgba(28,31,41,0.55)" }}>{sub}</span>}
    </div>
  );
}

/** مدالِ نشانِ دایره‌ای با حلقه‌ی گرادینتی. */
export function Badge({
  ring,
  icon,
  iconColor,
  label,
  locked = false,
}: {
  ring: string;
  icon: string;
  iconColor: string;
  label: string;
  locked?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2 w-[72px] shrink-0">
      <div className="badge-disc" style={{ background: locked ? "var(--t-grey)" : ring }}>
        <div className="badge-inner">
          <AppIcon name={locked ? "lock" : icon} size={locked ? 20 : 24} style={{ color: locked ? "var(--secondary)" : iconColor }} />
        </div>
      </div>
      <span className="t-cap text-center" style={{ color: "var(--label)", fontWeight: 600, fontSize: 11 }}>{label}</span>
    </div>
  );
}

/** کارتِ فعالیتِ مشکی با میله‌ی راه‌راهِ مورب و حبابِ مقدار. */
export function DarkActivityChart({
  title,
  value,
  unit,
  data,
  accent = "var(--teal)",
  peakLabel,
}: {
  title: string;
  value: ReactNode;
  unit?: string;
  data: { l: string; v: number; hi?: boolean }[];
  accent?: string;
  peakLabel?: string;
}) {
  const max = Math.max(...data.map((d) => d.v), 1);
  return (
    <div className="dark-card">
      <div className="flex items-start justify-between">
        <div>
          <div className="t-cap" style={{ color: "rgba(255,255,255,0.6)" }}>{title}</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="num" style={{ fontSize: 30, color: "#fff" }}>{value}</span>
            {unit && <span className="t-cap" style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>{unit}</span>}
          </div>
        </div>
        <span className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white/10 text-white">
          <AppIcon name="chart" size={18} />
        </span>
      </div>
      <div className="dark-bars">
        {data.map((d, i) => (
          <div key={i} className="dbar-col">
            {d.hi && peakLabel && <div className="peak-pill" style={{ background: accent }}>{peakLabel}</div>}
            <div
              className="dbar"
              style={
                d.hi
                  ? { height: `${(d.v / max) * 100}%`, background: `repeating-linear-gradient(135deg, ${accent} 0 6px, ${accent}99 6px 12px)` }
                  : { height: `${(d.v / max) * 100}%`, background: "rgba(255,255,255,0.10)" }
              }
            />
            <span className="t-cap" style={{ color: "rgba(255,255,255,0.5)", fontSize: 10.5 }}>{d.l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** نمودار میله‌ای روشن (پاستلی، یکی هایلایت). */
export function BarChart({
  data,
  accent = "var(--peach)",
  muted = "rgba(22,24,31,0.10)",
  height = 92,
  labels = false,
}: {
  data: { l: string; v: number; hi?: boolean }[];
  accent?: string;
  muted?: string;
  height?: number;
  labels?: boolean;
}) {
  const max = Math.max(...data.map((d) => d.v), 1);
  return (
    <div>
      <div className="bars" style={{ height }}>
        {data.map((d, i) => (
          <div key={i} className="bar-col">
            <div className="bar" style={{ height: `${(d.v / max) * 100}%`, background: d.hi ? accent : muted }} />
          </div>
        ))}
      </div>
      {labels && (
        <div className="flex gap-2 mt-2">
          {data.map((d, i) => (
            <span key={i} className="t-cap flex-1 text-center" style={{ fontSize: 10.5 }}>{d.l}</span>
          ))}
        </div>
      )}
    </div>
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
  fillHeight = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  fillHeight?: boolean;
}) {
  const [kb, setKb] = useState(0);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  useEffect(() => {
    if (!open || !fillHeight || typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      const overlap = window.innerHeight - vv.height - vv.offsetTop;
      setKb(overlap > 80 ? Math.round(overlap) : 0);
    };
    onResize();
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onResize);
      setKb(0);
    };
  }, [open, fillHeight]);

  if (!open) return null;

  const sheetClass = fillHeight
    ? "glass-strong relative w-full sm:max-w-md rounded-t-[34px] sm:rounded-[36px] shadow-float border border-[var(--border)] animate-sheet-up flex flex-col overflow-hidden"
    : "glass-strong relative w-full sm:max-w-md rounded-t-[34px] sm:rounded-[36px] shadow-float border border-[var(--border)] animate-sheet-up max-h-[92vh] overflow-y-auto pb-[max(20px,env(safe-area-inset-bottom))]";

  const sheetStyle: CSSProperties | undefined = fillHeight
    ? { height: "min(86dvh, 640px)", maxHeight: `calc(100dvh - ${kb}px - 12px)`, marginBottom: kb || undefined }
    : undefined;

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
        <div className="absolute inset-0 bg-[#1a1430]/30 backdrop-blur-md animate-[fade-up_0.2s_ease]" onClick={onClose} />
        <div className={sheetClass} style={sheetStyle}>
          <div className={`${fillHeight ? "" : "sticky top-0"} glass-strong z-10 flex items-center justify-between px-5 pt-4 pb-3 shrink-0`}>
            <div className="absolute top-2 left-1/2 -translate-x-1/2 h-1.5 w-10 rounded-full bg-[var(--label)]/15" />
            <h3 className="text-[20px] font-bold mt-2">{title}</h3>
            <button onClick={onClose} className="mt-2 text-ios-blue text-[17px] font-medium active:opacity-60">بستن</button>
          </div>
          {fillHeight ? (
            <div className="flex-1 min-h-0 flex flex-col px-5 pt-1 pb-[max(12px,env(safe-area-inset-bottom))]">{children}</div>
          ) : (
            <div className="px-5 pt-1">{children}</div>
          )}
        </div>
      </div>
    </Portal>
  );
}

export function EmptyState({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      <div className="mb-3 h-16 w-16 rounded-[22px] bg-[var(--t-blue)] flex items-center justify-center" style={{ color: "var(--blue)" }}>
        <AppIcon name={icon} size={30} />
      </div>
      <p className="text-[17px] font-semibold">{title}</p>
      {sub && <p className="secondary text-[15px] mt-1">{sub}</p>}
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <div className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} />
  );
}

export function ConfirmDialog({
  open, title, message, confirmLabel = "تأیید", cancelLabel = "انصراف", danger = false, onConfirm, onCancel,
}: {
  open: boolean; title: string; message?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;
  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex items-center justify-center px-8">
        <div className="absolute inset-0 bg-[#1a1430]/35 backdrop-blur-md animate-[fade-up_0.2s_ease]" onClick={onCancel} />
        <div className="glass-strong relative w-full max-w-[300px] rounded-[30px] shadow-float border border-[var(--border)] p-6 text-center animate-scale-in">
          <h3 className="text-[18px] font-extrabold leading-snug">{title}</h3>
          {message && <p className="secondary text-[14px] leading-7 mt-2">{message}</p>}
          <div className="flex gap-2.5 mt-5">
            <button onClick={onCancel} className="flex-1 ios-btn-ghost !py-3 !text-[16px]">{cancelLabel}</button>
            <button
              onClick={onConfirm}
              className={`flex-1 !py-3 !text-[16px] ${danger ? "ios-btn-primary" : "ios-btn-primary"}`}
              style={danger ? { background: "#f08197", boxShadow: "0 12px 26px -10px rgba(240,129,151,0.5)" } : undefined}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

export type ConfirmOptions = {
  title: string; message?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean;
};

export function useConfirm() {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((o: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => { resolver.current = resolve; setOpts(o); });
  }, []);

  const settle = useCallback((v: boolean) => {
    resolver.current?.(v); resolver.current = null; setOpts(null);
  }, []);

  const dialog = (
    <ConfirmDialog
      open={opts !== null} title={opts?.title ?? ""} message={opts?.message}
      confirmLabel={opts?.confirmLabel} cancelLabel={opts?.cancelLabel} danger={opts?.danger}
      onConfirm={() => settle(true)} onCancel={() => settle(false)}
    />
  );

  return { confirm, dialog };
}

export function Segmented<T extends string>({
  options, value, onChange,
}: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-[18px] bg-[var(--label)]/[0.05] p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`min-w-0 flex-1 truncate whitespace-nowrap rounded-[14px] px-1 py-2 text-[14px] font-semibold transition ${
            value === o.value ? "bg-white shadow-soft" : "secondary"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chevron({
  dir = "forward", size = 20, className = "",
}: {
  dir?: "forward" | "back"; size?: number; className?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={dir === "back" ? "m9 18 6-6-6-6" : "m15 18-6-6 6-6"} />
    </svg>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-[var(--label)]/[0.06] ${className}`} aria-hidden />;
}
