import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-vazir)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-vazir)", "serif"],
      },
      colors: {
        // پالتِ مهارشده: آبی + سبزِ مریمی + هلویی، روی آف‌وایت
        ios: {
          bg: "#f4f2ee",
          card: "#ffffff",
          sep: "#eef0f4",
          gray: "#8b90a0",
          label: "#1c1f29",
          ink: "#16181f",
          blue: "#1f6ca6",
          green: "#6fa386",
          orange: "#ef9d63",
          red: "#f08197",
          purple: "#8f86e6",
          pink: "#f08197",
          teal: "#3aa6b8",
          indigo: "#16517d",
          yellow: "#efc25e",
          peach: "#ef9d63",
          apricot: "#efc25e",
          sage: "#6fa386",
          lav: "#8f86e6",
          cream: "#f4f2ee",
        },
      },
      borderRadius: {
        "ios-sm": "1rem",    // 16px
        ios: "1.5rem",       // 24px
        "ios-lg": "1.875rem", // 30px
        "ios-xl": "2.375rem", // 38px
      },
      boxShadow: {
        card: "0 2px 6px -2px rgba(30,40,70,0.06), 0 18px 40px -22px rgba(30,40,70,0.26)",
        soft: "0 1px 2px rgba(30,40,70,0.04), 0 6px 16px -10px rgba(30,40,70,0.18)",
        float: "0 30px 70px -30px rgba(30,40,70,0.34)",
        glow: "0 16px 30px -12px rgba(20,22,30,0.7)",
        dark: "0 24px 50px -22px rgba(20,22,30,0.45)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
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
          "50%": { transform: "translateY(-9px)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both",
        "sheet-up": "sheet-up 0.35s cubic-bezier(0.16,1,0.3,1) both",
        "scale-in": "scale-in 0.25s cubic-bezier(0.16,1,0.3,1) both",
        float: "float 5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
