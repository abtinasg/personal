import type { Metadata, Viewport } from "next";
import { Vazirmatn, Markazi_Text } from "next/font/google";
import "./globals.css";

const vazir = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-vazir",
  display: "swap",
});

// فونتِ نمایشیِ مجله‌ای برای تیترها — کنتراست و وقارِ کلاسیکِ فارسی
const markazi = Markazi_Text({
  subsets: ["arabic", "latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const appName = process.env.NEXT_PUBLIC_APP_NAME || "امروز";

export const metadata: Metadata = {
  title: { default: `40411649`, template: `%s · ${appName}` },
  description:
    "امروز: عمرت جمعِ همین «امروز»هاست. عادت‌های اتمی، کالری با هوش مصنوعی، بودجه، سلامتی و یک مربیِ همیشه‌همراه — همین امروز شروع کن، با ورودِ بی‌رمز با پسکی.",
  appleWebApp: { capable: true, statusBarStyle: "default", title: appName },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eceefb" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0e1a" },
  ],
  width: "device-width",
  initialScale: 1,
  // اجازه‌ی زوم برای دسترس‌پذیری (پیش‌تر zoom غیرفعال بود)
  maximumScale: 5,
  // با بازشدنِ کیبورد، layout کوچک می‌شود تا فیلدِ ورودیِ چت زیرِ صفحه نرود.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl" className={`${vazir.variable} ${markazi.variable}`}>
      <body>{children}</body>
    </html>
  );
}
