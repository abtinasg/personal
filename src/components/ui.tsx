"use client";

import { CSSProperties, ReactNode, useCallback, useEffect, useRef, useState } from "react";
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
  fillHeight = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** برای شیت‌های چت: ارتفاعِ ثابت می‌گیرد، خودش اسکرول نمی‌کند و بالای کیبورد می‌ماند. */
  fillHeight?: boolean;
}) {
  // ارتفاعِ کیبوردِ موبایل تا شیت روی آن نرود و فیلدِ ورودی «زیرِ صفحه» نیفتد.
  const [kb, setKb] = useState(0);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
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
    ? {
        height: "min(86dvh, 640px)",
        maxHeight: `calc(100dvh - ${kb}px - 12px)`,
        marginBottom: kb || undefined,
      }
    : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-[#1a1430]/30 backdrop-blur-md animate-[fade-up_0.2s_ease]" onClick={onClose} />
      <div className={sheetClass} style={sheetStyle}>
        <div className={`${fillHeight ? "" : "sticky top-0"} glass-strong z-10 flex items-center justify-between px-5 pt-4 pb-3 shrink-0`}>
          <div className="absolute top-2 left-1/2 -translate-x-1/2 h-1.5 w-10 rounded-full bg-[var(--label)]/15" />
          <h3 className="text-[20px] font-bold mt-2">{title}</h3>
          <button onClick={onClose} className="mt-2 text-ios-blue text-[17px] font-medium active:opacity-60">
            بستن
          </button>
        </div>
        {fillHeight ? (
          <div className="flex-1 min-h-0 flex flex-col px-5 pt-1 pb-[max(12px,env(safe-area-inset-bottom))]">{children}</div>
        ) : (
          <div className="px-5 pt-1">{children}</div>
        )}
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

/** دیالوگِ تأییدِ اپل‌استایل — جایگزینِ confirm() نیتیو. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "تأیید",
  cancelLabel = "انصراف",
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-8">
      <div
        className="absolute inset-0 bg-[#1a1430]/35 backdrop-blur-md animate-[fade-up_0.2s_ease]"
        onClick={onCancel}
      />
      <div className="glass-strong relative w-full max-w-[300px] rounded-[30px] shadow-float border border-[var(--border)] p-6 text-center animate-scale-in">
        <h3 className="text-[18px] font-extrabold leading-snug">{title}</h3>
        {message && <p className="secondary text-[14px] leading-7 mt-2">{message}</p>}
        <div className="flex gap-2.5 mt-5">
          <button onClick={onCancel} className="flex-1 ios-btn-ghost !py-3 !text-[16px]">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 !py-3 !text-[16px] ${danger ? "ios-btn text-white" : "ios-btn-primary"}`}
            style={
              danger
                ? {
                    backgroundImage: "linear-gradient(135deg,#fb7a8f,#f5536f)",
                    boxShadow: "0 12px 26px -10px rgba(245,97,120,0.5), inset 0 1px 0 rgba(255,255,255,0.3)",
                  }
                : undefined
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

/** هوکِ تأیید: یک confirm پرامیس‌محور می‌دهد و المانِ دیالوگ را برای رندر. */
export function useConfirm() {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((o: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setOpts(o);
    });
  }, []);

  const settle = useCallback((v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpts(null);
  }, []);

  const dialog = (
    <ConfirmDialog
      open={opts !== null}
      title={opts?.title ?? ""}
      message={opts?.message}
      confirmLabel={opts?.confirmLabel}
      cancelLabel={opts?.cancelLabel}
      danger={opts?.danger}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  );

  return { confirm, dialog };
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
          className={`min-w-0 flex-1 truncate whitespace-nowrap rounded-[14px] px-1 py-2 text-[14px] font-semibold transition ${
            value === o.value ? "bg-[var(--card-solid)] shadow-soft" : "secondary"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** شِوران (پیکانِ جهت‌دار). در RTL، «forward» به چپ و «back» به راست اشاره می‌کند. */
export function Chevron({
  dir = "forward",
  size = 20,
  className = "",
}: {
  dir?: "forward" | "back";
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={dir === "back" ? "m9 18 6-6-6-6" : "m15 18-6-6 6-6"} />
    </svg>
  );
}

/** اسکلتِ بارگذاری — جای‌گیرِ نرم به‌جای پرشِ ناگهانیِ محتوا. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-[var(--label)]/[0.06] ${className}`} aria-hidden />;
}
