import { adminAuthed, ok, bad } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  const a = await adminAuthed("manage_data");
  if ("error" in a) return a.error;

  const { data, error } = await a.db
    .from("blog_posts")
    .select("id, slug, title, published, published_at, tags, reading_time, created_at")
    .order("created_at", { ascending: false });

  if (error) return bad(error.message, 500);
  return ok(data);
}

export async function POST(request: Request) {
  const a = await adminAuthed("manage_data");
  if ("error" in a) return a.error;

  const body = await request.json();
  const { title, slug, seo_title, seo_description, content, cover_url, tags, reading_time, published } =
    body as Record<string, unknown>;

  if (!title || !slug) return bad("عنوان و slug اجباری است");

  const { data, error } = await a.db
    .from("blog_posts")
    .insert({
      title,
      slug,
      seo_title: seo_title || null,
      seo_description: seo_description || null,
      content: content || "",
      cover_url: cover_url || null,
      tags: Array.isArray(tags) ? tags : [],
      reading_time: Number(reading_time) || 3,
      published: !!published,
      published_at: published ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error) return bad(error.message, 500);
  return ok(data);
}
