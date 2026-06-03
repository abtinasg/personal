import type { MetadataRoute } from "next";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "یک‌درصد";

/**
 * مانیفستِ PWA — تا «یک‌درصد» واقعاً روی گوشی نصب‌شدنی باشد.
 * Next این فایل را به‌صورت /manifest.webmanifest سرو می‌کند و
 * تگِ <link rel="manifest"> را خودکار در <head> می‌گذارد.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${appName} — هر روز یک‌درصد بهتر`,
    short_name: appName,
    description:
      "هویت‌ات را بساز و هر روز یک‌درصد بهتر شو: عادت‌های اتمی، کالریِ هوشمند، بودجه، سلامتی و یک مربیِ همیشه‌همراه.",
    lang: "fa",
    dir: "rtl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#eceefb",
    theme_color: "#8267f2",
    categories: ["lifestyle", "health", "productivity"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
