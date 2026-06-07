import type { MetadataRoute } from "next";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "امروز";

/**
 * مانیفستِ PWA — تا «امروز» واقعاً روی گوشی نصب‌شدنی باشد.
 * Next این فایل را به‌صورت /manifest.webmanifest سرو می‌کند و
 * تگِ <link rel="manifest"> را خودکار در <head> می‌گذارد.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${appName} — همین امروز`,
    short_name: appName,
    description:
      "عمرت جمعِ همین «امروز»هاست: عادت‌های اتمی، کالریِ هوشمند، بودجه، سلامتی و یک مربیِ همیشه‌همراه.",
    lang: "fa",
    dir: "rtl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#eef3f7",
    theme_color: "#1f6ca6",
    categories: ["lifestyle", "health", "productivity"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
