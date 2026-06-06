/**
 * «جوانه» — آدمکِ مربیِ امروز. یک جوانه‌ی نرم و گِرد، هم‌خوان با تزِ «همین
 * امروز»: نهالی که با تو رشد می‌کند. به‌صورتِ SVGِ نیمه‌سه‌بعدی کشیده شده.
 * ژست‌ها: "wave" | "cheer" | "idle".
 */
"use client";

import { useId } from "react";

type Pose = "idle" | "wave" | "cheer";

export function Mascot({
  size = 200,
  pose = "idle",
  float = false,
  shadow = true,
  className = "",
}: {
  size?: number;
  pose?: Pose;
  float?: boolean;
  shadow?: boolean;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const g = (s: string) => `${uid}-${s}`;
  const h = (size / 200) * 240;

  const rArm =
    pose === "cheer" ? "rotate(-34 150 150)" : pose === "wave" ? "rotate(-52 150 138)" : "rotate(-8 150 152)";
  const lArm = pose === "cheer" ? "rotate(34 50 150)" : "rotate(10 50 152)";

  return (
    <svg
      width={size}
      height={h}
      viewBox="0 0 200 240"
      fill="none"
      className={`${float ? "animate-float" : ""} ${className}`.trim()}
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        <linearGradient id={g("body")} x1="40" y1="70" x2="170" y2="216" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5fa8d6" />
          <stop offset="0.5" stopColor="#2f81b8" />
          <stop offset="1" stopColor="#1c5f90" />
        </linearGradient>
        <radialGradient id={g("belly")} cx="0.42" cy="0.36" r="0.7">
          <stop offset="0" stopColor="#eaf6ff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#eaf6ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={g("leaf")} x1="86" y1="20" x2="120" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#86c79a" />
          <stop offset="1" stopColor="#5b9d74" />
        </linearGradient>
        <radialGradient id={g("sh")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#1d2740" stopOpacity="0.22" />
          <stop offset="1" stopColor="#1d2740" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* سایه‌ی زمین */}
      {shadow && <ellipse cx="100" cy="224" rx="58" ry="12" fill={`url(#${g("sh")})`} />}

      {/* جوانه: ساقه + برگ (رشد) */}
      <path d="M100 78 C100 60 100 52 100 44" stroke="#5b9d74" strokeWidth="6" strokeLinecap="round" />
      <path d="M100 50 C108 36 124 32 134 30 C133 44 126 58 110 60 C104 60 100 56 100 50 Z" fill={`url(#${g("leaf")})`} />
      <path d="M104 52 C114 46 122 42 130 38" stroke="#bfe3cb" strokeWidth="2.4" strokeLinecap="round" opacity="0.8" />
      <circle cx="100" cy="44" r="4.5" fill="#efc25e" />

      {/* بازوها (پشتِ بدن) */}
      <g transform={lArm}>
        <rect x="38" y="138" width="20" height="44" rx="10" fill="#2a76ac" />
        <circle cx="48" cy="184" r="12" fill="#3d8ec2" />
      </g>
      <g transform={rArm}>
        <rect x="142" y="132" width="20" height="46" rx="10" fill="#2a76ac" />
        <circle cx="152" cy={pose === "idle" ? 180 : 132} r="12" fill="#3d8ec2" />
      </g>

      {/* بدن */}
      <rect x="44" y="76" width="112" height="138" rx="56" fill={`url(#${g("body")})`} />
      <rect x="44" y="76" width="112" height="138" rx="56" fill={`url(#${g("belly")})`} />
      <ellipse cx="100" cy="158" rx="40" ry="46" fill="#eef8ff" opacity="0.55" />

      {/* پاها */}
      <ellipse cx="78" cy="214" rx="16" ry="11" fill="#1c5f90" />
      <ellipse cx="122" cy="214" rx="16" ry="11" fill="#1c5f90" />

      {/* صورت */}
      <g>
        <ellipse cx="83" cy="132" rx="14" ry="16.5" fill="#ffffff" />
        <ellipse cx="117" cy="132" rx="14" ry="16.5" fill="#ffffff" />
        <circle cx="85" cy="135" r="6.6" fill="#1b2330" />
        <circle cx="115" cy="135" r="6.6" fill="#1b2330" />
        <circle cx="87.5" cy="132" r="2.3" fill="#fff" />
        <circle cx="117.5" cy="132" r="2.3" fill="#fff" />
        <circle cx="64" cy="152" r="8" fill="#ef9d63" opacity="0.45" />
        <circle cx="136" cy="152" r="8" fill="#ef9d63" opacity="0.45" />
        <path d="M88 152 C94 160 106 160 112 152" stroke="#1b2330" strokeWidth="3.4" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  );
}

/** نسخه‌ی گِردِ کوچک (فقط سر) برای آواتارِ چت/کارتِ مربی. */
export function MascotAvatar({ size = 44, className = "" }: { size?: number; className?: string }) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" style={{ display: "block" }} className={className}>
      <defs>
        <linearGradient id={`${uid}b`} x1="12" y1="10" x2="54" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5fa8d6" />
          <stop offset="1" stopColor="#1c5f90" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="34" r="26" fill={`url(#${uid}b)`} />
      <path d="M32 10 C32 4 32 4 32 2" stroke="#5b9d74" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M32 6 C38 -2 48 -3 53 -4 C52 5 47 13 37 14 C34 14 32 11 32 6 Z" fill="#6cb185" transform="translate(0,6)" />
      <ellipse cx="24" cy="32" rx="6.6" ry="7.8" fill="#fff" />
      <ellipse cx="40" cy="32" rx="6.6" ry="7.8" fill="#fff" />
      <circle cx="25" cy="34" r="3.2" fill="#1b2330" />
      <circle cx="41" cy="34" r="3.2" fill="#1b2330" />
      <circle cx="18" cy="40" r="4" fill="#ef9d63" opacity="0.5" />
      <circle cx="46" cy="40" r="4" fill="#ef9d63" opacity="0.5" />
      <path d="M27 42 C30 46 34 46 37 42" stroke="#1b2330" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    </svg>
  );
}
