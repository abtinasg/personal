import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-vazir)", "system-ui", "sans-serif"],
      },
      colors: {
        // پالت رؤیایی و پاستلی — سطوح هواگونه و رنگ‌های نرمِ گرادیانی
        ios: {
          bg: "#eceefb",
          card: "#ffffff",
          sep: "#e6e7f5",
          gray: "#888da6",
          label: "#262a40",
          blue: "#5b76f0",
          green: "#22c391",
          orange: "#fb9a5b",
          red: "#f56178",
          purple: "#a96ff0",
          pink: "#fb7fa0",
          teal: "#2cb8cf",
          indigo: "#8267f2",
          yellow: "#f5c451",
        },
      },
      borderRadius: {
        "ios-sm": "1.125rem", // 18px
        ios: "1.75rem", // 28px
        "ios-lg": "2.25rem", // 36px
      },
      boxShadow: {
        // سایه‌های بسیار نرم با بلورِ بالا، اوپَسیتیِ کم و تهِ‌رنگِ نیلی
        card: "0 2px 6px -2px rgba(76,70,160,0.10), 0 18px 42px -18px rgba(76,70,160,0.22)",
        soft: "0 1px 2px rgba(76,70,160,0.05), 0 10px 28px -14px rgba(76,70,160,0.18)",
        float: "0 30px 70px -24px rgba(76,70,160,0.32)",
        glow: "0 12px 32px -10px rgba(120,110,250,0.5)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "sheet-up": {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.4s cubic-bezier(0.16,1,0.3,1) both",
        "sheet-up": "sheet-up 0.35s cubic-bezier(0.16,1,0.3,1) both",
        "scale-in": "scale-in 0.25s cubic-bezier(0.16,1,0.3,1) both",
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
