/**
 * نشانِ برند «امروز» — «جوانه»: ساقه‌ای که رشد می‌کند، یک برگ و جوانه‌ی طلایی
 * در نوک. استعاره‌ی تزِ اپ: هر «امروز» یک قدمِ کوچکِ رشد است. هم‌خانواده با
 * ماسکوتِ «جوانه» (همان پالتِ آبی/سبز/طلایی) تا برند یک‌دست باشد.
 *
 * حالتِ پیش‌فرض خطی (color, تک‌رنگ برای نوار/متن)؛ با filled نشانِ گرادیانیِ
 * تو‌پُر و رنگی برای آیکونِ اپ و سرتیترها.
 */
export function Logo({ size = 44, color = "#fff", filled = false }: { size?: number; color?: string; filled?: boolean }) {
  // ساقه‌ی متقارن که از پایین رشد می‌کند تا زیرِ جوانه
  const stem = "M12 21 C 11.7 17.5 11.7 14.5 12 11.8";
  // برگِ راست — هم‌فرم با آیکونِ اپ
  const leafR = "M12 14.4 C 13.4 12.3 15.7 11.7 17.8 11.9 C 17.4 14.1 15.4 15.8 13.2 15.5 C 12.3 15.4 11.7 14.9 12 14.4 Z";
  // برگِ چپ — قرینه و کمی پایین‌تر
  const leafL = "M12 15.9 C 10.6 14 8.4 13.5 6.4 13.8 C 6.9 15.9 8.7 17.4 10.8 17 C 11.7 16.8 12.3 16.4 12 15.9 Z";

  if (filled) {
    const uid = "logoMark";
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <defs>
          <linearGradient id={`${uid}-stem`} x1="12" y1="21" x2="12" y2="11" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#5fa8d6" />
            <stop offset="1" stopColor="#1c5f90" />
          </linearGradient>
          <linearGradient id={`${uid}-leaf`} x1="12" y1="11.5" x2="12" y2="17.5" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#a7e0bc" />
            <stop offset="1" stopColor="#5b9d74" />
          </linearGradient>
          <radialGradient id={`${uid}-bud`} cx="0.4" cy="0.35" r="0.7">
            <stop offset="0" stopColor="#ffe3a3" />
            <stop offset="1" stopColor="#e0a83f" />
          </radialGradient>
        </defs>
        <path d={stem} stroke={`url(#${uid}-stem)`} strokeWidth={2.2} strokeLinecap="round" fill="none" />
        <path d={leafR} fill={`url(#${uid}-leaf)`} />
        <path d={leafL} fill={`url(#${uid}-leaf)`} />
        {/* جوانه‌ی طلایی در نوک */}
        <circle cx="12" cy="10.5" r="1.7" fill={`url(#${uid}-bud)`} />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={stem} fill="none" />
      <path d={leafR} fill="none" />
      <path d={leafL} fill="none" />
      <circle cx="12" cy="10.4" r="1.2" fill={color} stroke="none" />
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
