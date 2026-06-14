import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://yekdarsad.ir";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/blog", "/blog/"],
        disallow: ["/api/", "/(app)/"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
