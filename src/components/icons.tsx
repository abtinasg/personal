/**
 * نشانِ برند «امروز» — منحنیِ رشدِ مرکب که شتاب می‌گیرد و رو به بالا می‌رود؛
 * سه نقطه‌ی روزانه روی منحنی، استعاره‌ی «هر امروز» که در طول زمان مرکب می‌شود.
 * حالتِ پیش‌فرض خطی (color)؛ با filled یک نشانِ گرادیانیِ تو‌پُر برای آیکونِ اپ می‌دهد.
 */
export function Logo({ size = 44, color = "#fff", filled = false }: { size?: number; color?: string; filled?: boolean }) {
  // منحنیِ نمایی از پایین-راست به بالا-چپ (RTL: رشد به سمتِ بالا)
  const curve = "M3.5 17.6 C 7.6 17 9.8 14.6 11.8 11.4 C 13.7 8.4 15.8 5.7 20.3 4.4";

  if (filled) {
    const gid = "logoGrad";
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <defs>
          <linearGradient id={gid} x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#f5b87a" />
            <stop offset="0.55" stopColor="#f5956b" />
            <stop offset="1" stopColor="#e8724a" />
          </linearGradient>
        </defs>
        {/* سطحِ زیرِ منحنی — حسِ انباشت و رشد */}
        <path d={`${curve} L 20.3 19.5 L 3.5 19.5 Z`} fill={`url(#${gid})`} opacity={0.22} />
        <path d={curve} stroke={`url(#${gid})`} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {/* سرپیکانِ بالا */}
        <path d="M15.6 4 H20.6 V9" stroke={`url(#${gid})`} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {/* نقاطِ روزانه که بزرگ‌تر می‌شوند (مرکب‌شدن) */}
        <circle cx="6.4" cy="17.1" r="0.95" fill="#f5b87a" />
        <circle cx="11.8" cy="11.4" r="1.3" fill="#f5956b" />
        <circle cx="20.3" cy="4.4" r="1.7" fill="#e8724a" />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={curve} />
      <path d="M15.6 4h5v5" />
      <circle cx="6.4" cy="17.1" r="0.9" fill={color} stroke="none" />
      <circle cx="11.8" cy="11.4" r="1.15" fill={color} stroke="none" />
      <circle cx="20.3" cy="4.4" r="1.5" fill={color} stroke="none" />
    </svg>
  );
}

export function Icon({ name, active }: { name: string; active?: boolean }) {
  const sw = active ? 2.4 : 2;
  const common = {
    width: 26,
    height: 26,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: sw,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
        </svg>
      );
    case "calorie":
      return (
        <svg {...common}>
          <path d="M12 3c1.5 2.5 4.5 4 4.5 8a4.5 4.5 0 1 1-9 0c0-2 1-3.2 2-4.5" />
        </svg>
      );
    case "budget":
      return (
        <svg {...common}>
          <rect x="3" y="6" width="18" height="13" rx="3" />
          <path d="M3 10h18" />
          <circle cx="17" cy="14.5" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
    case "health":
      return (
        <svg {...common}>
          <path d="M20.8 7.6a5 5 0 0 0-8.8-2 5 5 0 0 0-8.8 2c-1 3.3 1.7 6.3 4.3 8.6 1.6 1.4 3.2 2.6 4.5 3.6 1.3-1 2.9-2.2 4.5-3.6 2.6-2.3 5.3-5.3 4.3-8.6Z" />
        </svg>
      );
    case "habit":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8.5 12 2.3 2.3L15.8 9" />
        </svg>
      );
    case "missions":
      return (
        <svg {...common}>
          <path d="M4 21V4" />
          <path d="M4 4c4-2 8 2 12 0v9c-4 2-8-2-12 0" />
        </svg>
      );
    case "identity":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.4" />
          <path d="M5.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
        </svg>
      );
    case "more":
      return (
        <svg {...common}>
          <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      );
    case "grow":
      // جوانه‌ی رو به بالا — نمادِ رشد
      return (
        <svg {...common}>
          <path d="M12 21v-9" />
          <path d="M12 12c0-3 2.2-5.2 5.5-5.2C17.5 9.8 15.3 12 12 12Z" />
          <path d="M12 14.5c0-2.6-2-4.6-5-4.6 0 2.6 2 4.6 5 4.6Z" />
        </svg>
      );
    case "coach":
      // قطب‌نما — مربیِ راهنما
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="m15.2 8.8-2 4.4-4.4 2 2-4.4 4.4-2Z" />
        </svg>
      );
    default:
      return null;
  }
}
