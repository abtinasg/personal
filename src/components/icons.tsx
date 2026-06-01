/** نشانِ برند «یک‌درصد» — منحنیِ رشدِ مرکب که رو به بالا می‌رود. خطِ سفید روی گرادیان. */
export function Logo({ size = 44, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 16.8C8 16.4 9.6 10.4 13 8.4 16 6.6 17.6 6 20.5 6" />
      <path d="M14.6 6h5.9v5.9" />
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
    default:
      return null;
  }
}
