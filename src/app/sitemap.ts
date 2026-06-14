import type { MetadataRoute } from "next";
import { getServiceClient } from "@/lib/supabase";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://yekdarsad.ir";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = getServiceClient();

  let posts: { slug: string; published_at: string }[] = [];
  try {
    const { data } = await db
      .from("blog_posts")
      .select("slug, published_at")
      .eq("published", true)
      .order("published_at", { ascending: false });
    posts = (data ?? []) as typeof posts;
  } catch {
    posts = [];
  }

  const static_routes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`,     lastModified: new Date(), changeFrequency: "weekly",  priority: 1 },
    { url: `${BASE_URL}/blog`, lastModified: new Date(), changeFrequency: "daily",   priority: 0.9 },
  ];

  const blog_routes: MetadataRoute.Sitemap = posts.map((p) => ({
    url:             `${BASE_URL}/blog/${p.slug}`,
    lastModified:    new Date(p.published_at),
    changeFrequency: "monthly" as const,
    priority:        0.7,
  }));

  return [...static_routes, ...blog_routes];
}
