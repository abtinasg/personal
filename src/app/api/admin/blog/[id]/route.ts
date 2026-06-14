import { adminAuthed, ok, bad } from "@/lib/api";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await adminAuthed("manage_data");
  if ("error" in a) return a.error;

  const { id } = await params;
  const body = await request.json() as Record<string, unknown>;

  const { data: existing } = await a.db
    .from("blog_posts")
    .select("published, published_at")
    .eq("id", id)
    .maybeSingle();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.title      !== undefined) updates.title       = body.title;
  if (body.slug       !== undefined) updates.slug        = body.slug;
  if (body.seo_title  !== undefined) updates.seo_title   = body.seo_title  || null;
  if (body.seo_description !== undefined) updates.seo_description = body.seo_description || null;
  if (body.content    !== undefined) updates.content     = body.content;
  if (body.cover_url  !== undefined) updates.cover_url   = body.cover_url  || null;
  if (body.tags       !== undefined) updates.tags        = Array.isArray(body.tags) ? body.tags : [];
  if (body.reading_time !== undefined) updates.reading_time = Number(body.reading_time) || 3;
  if (body.published  !== undefined) {
    updates.published = !!body.published;
    if (body.published && !existing?.published_at) {
      updates.published_at = new Date().toISOString();
    }
  }

  const { error } = await a.db.from("blog_posts").update(updates).eq("id", id);
  if (error) return bad(error.message, 500);
  return ok();
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await adminAuthed("manage_data");
  if ("error" in a) return a.error;

  const { id } = await params;
  const { error } = await a.db.from("blog_posts").delete().eq("id", id);
  if (error) return bad(error.message, 500);
  return ok();
}
