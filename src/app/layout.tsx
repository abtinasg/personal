import type { Metadata, Viewport } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";

const vazir = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-vazir",
  display: "swap",
});

const appName = process.env.NEXT_PUBLIC_APP_NAME || "یک‌درصد";

export const metadata: Metadata = {
  title: { default: `${appName} — هر روز یک‌درصد بهتر`, template: `%s · ${appName}` },
  description:
    "یک‌درصد: هویت‌ات را بساز و هر روز یک‌درصد بهتر شو. ماموریت‌ها، عادت‌های اتمی، کالری با هوش مصنوعی، بودجه، سلامتی و یک مربیِ همیشه‌همراه — ورود بی‌رمز با پسکی.",
  appleWebApp: { capable: true, statusBarStyle: "default", title: appName },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eceefb" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0e1a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl" className={vazir.variable}>
      <body>{children}</body>
    </html>
  );
}
