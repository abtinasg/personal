import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const tag = searchParams.get("tag") ?? "";
  const per = 20;
  const offset = (page - 1) * per;

  const db = getServiceClient();

  try {
    let rows: unknown[], total: number;

    if (tag) {
      const [countRes, dataRes] = await Promise.all([
        db.query<{ count: string }>(
          `SELECT COUNT(*) AS count FROM blog_posts WHERE published = true AND $1 = ANY(tags)`,
          [tag]
        ),
        db.query(
          `SELECT id, slug, title, seo_description, cover_url, tags, reading_time, published_at
           FROM blog_posts WHERE published = true AND $1 = ANY(tags)
           ORDER BY published_at DESC LIMIT $2 OFFSET $3`,
          [tag, per, offset]
        ),
      ]);
      total = Number(countRes[0]?.count ?? 0);
      rows = dataRes;
    } else {
      const { data, error, count } = await db
        .from("blog_posts")
        .select("id, slug, title, seo_description, cover_url, tags, reading_time, published_at", {
          count: "exact",
        })
        .eq("published", true)
        .order("published_at", { ascending: false })
        .range(offset, offset + per - 1);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      rows = data ?? [];
      total = count ?? 0;
    }

    return NextResponse.json({ posts: rows, total, page, per });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
