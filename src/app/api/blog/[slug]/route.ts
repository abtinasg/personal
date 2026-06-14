import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = getServiceClient();

  const { data, error } = await db
    .from("blog_posts")
    .select(
      "id, slug, title, seo_title, seo_description, content, cover_url, tags, reading_time, published_at"
    )
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "نوشته پیدا نشد" }, { status: 404 });
  return NextResponse.json(data);
}
