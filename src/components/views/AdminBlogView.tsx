"use client";

import { useCallback, useEffect, useState } from "react";
import { SectionTitle, Spinner } from "@/components/ui";

type Post = {
  id: string;
  slug: string;
  title: string;
  published: boolean;
  published_at: string | null;
  tags: string[];
  reading_time: number;
  created_at: string;
};

type FormData = {
  title: string;
  slug: string;
  seo_title: string;
  seo_description: string;
  content: string;
  cover_url: string;
  tags: string;
  reading_time: string;
  published: boolean;
};

const EMPTY_FORM: FormData = {
  title: "",
  slug: "",
  seo_title: "",
  seo_description: "",
  content: "",
  cover_url: "",
  tags: "",
  reading_time: "3",
  published: false,
};

function toSlug(text: string) {
  return text
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^؀-ۿa-zA-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function persianDate(iso: string) {
  return new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "long", day: "numeric" }).format(
    new Date(iso)
  );
}

export default function AdminBlogView() {
  const [posts, setPosts]         = useState<Post[]>([]);
  const [loading, setLoading]     = useState(true);
  const [form, setForm]           = useState<FormData>(EMPTY_FORM);
  const [editId, setEditId]       = useState<string | null>(null);
  const [showForm, setShowForm]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState("");
  const [preview, setPreview]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/blog");
    if (res.ok) setPosts(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setErr("");
    setPreview(false);
    setShowForm(true);
  }

  function openEdit(p: Post) {
    setForm({
      title:           p.title,
      slug:            p.slug,
      seo_title:       "",
      seo_description: "",
      content:         "",
      cover_url:       "",
      tags:            p.tags.join(", "),
      reading_time:    String(p.reading_time),
      published:       p.published,
    });
    setEditId(p.id);
    setErr("");
    setPreview(false);
    setShowForm(true);
    // fetch full post for editing
    fetch(`/api/admin/blog`)
      .then((r) => r.json())
      .then((all: Post[]) => {
        const found = all.find((x) => x.id === p.id);
        if (!found) return;
        // fetch full content via public API
        fetch(`/api/blog/${p.slug}`)
          .then((r) => r.json())
          .then((full) => {
            setForm((prev) => ({
              ...prev,
              seo_title:       full.seo_title       ?? "",
              seo_description: full.seo_description ?? "",
              content:         full.content         ?? "",
              cover_url:       full.cover_url        ?? "",
            }));
          });
      });
  }

  async function save() {
    setErr("");
    if (!form.title.trim()) return setErr("عنوان اجباری است");
    if (!form.slug.trim())  return setErr("slug اجباری است");

    setSaving(true);
    const body = {
      title:           form.title.trim(),
      slug:            form.slug.trim(),
      seo_title:       form.seo_title.trim()       || null,
      seo_description: form.seo_description.trim() || null,
      content:         form.content,
      cover_url:       form.cover_url.trim()        || null,
      tags:            form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      reading_time:    Number(form.reading_time) || 3,
      published:       form.published,
    };

    const url    = editId ? `/api/admin/blog/${editId}` : "/api/admin/blog";
    const method = editId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setErr(data.error ?? "خطا در ذخیره");
    setShowForm(false);
    load();
  }

  async function togglePublish(p: Post) {
    await fetch(`/api/admin/blog/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !p.published }),
    });
    load();
  }

  async function deletePost(p: Post) {
    if (!confirm(`حذف «${p.title}»؟`)) return;
    await fetch(`/api/admin/blog/${p.id}`, { method: "DELETE" });
    load();
  }

  if (loading) return <Spinner className="mt-10 block mx-auto" />;

  if (showForm) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <SectionTitle>{editId ? "ویرایش مقاله" : "مقاله‌ی جدید"}</SectionTitle>
          <button className="ios-btn-ghost" onClick={() => setShowForm(false)}>
            انصراف
          </button>
        </div>

        <div className="card" style={{ padding: "20px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* title */}
          <label style={labelStyle}>
            <span>عنوان *</span>
            <input
              className="ios-input"
              value={form.title}
              placeholder="عنوان مقاله"
              onChange={(e) => {
                const v = e.target.value;
                setForm((f) => ({ ...f, title: v, slug: editId ? f.slug : toSlug(v) }));
              }}
            />
          </label>

          {/* slug */}
          <label style={labelStyle}>
            <span>slug (URL) *</span>
            <input
              className="ios-input"
              value={form.slug}
              dir="ltr"
              placeholder="adat-sazi-chi-ast"
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            />
          </label>

          {/* SEO title */}
          <label style={labelStyle}>
            <span style={{ display: "flex", justifyContent: "space-between" }}>
              <span>عنوان SEO</span>
              <span style={{ color: form.seo_title.length > 60 ? "var(--danger,#ff453a)" : "var(--secondary)", fontSize: 12 }}>
                {form.seo_title.length}/60
              </span>
            </span>
            <input
              className="ios-input"
              value={form.seo_title}
              placeholder="عنوانِ دقیق‌تر برای گوگل (اختیاری)"
              onChange={(e) => setForm((f) => ({ ...f, seo_title: e.target.value }))}
            />
          </label>

          {/* SEO description */}
          <label style={labelStyle}>
            <span style={{ display: "flex", justifyContent: "space-between" }}>
              <span>توضیحات SEO</span>
              <span style={{ color: form.seo_description.length > 160 ? "var(--danger,#ff453a)" : "var(--secondary)", fontSize: 12 }}>
                {form.seo_description.length}/160
              </span>
            </span>
            <textarea
              className="ios-input"
              value={form.seo_description}
              rows={2}
              placeholder="خلاصه‌ای که در نتایج جستجو نشان داده می‌شود"
              onChange={(e) => setForm((f) => ({ ...f, seo_description: e.target.value }))}
              style={{ resize: "vertical" }}
            />
          </label>

          {/* tags */}
          <label style={labelStyle}>
            <span>تگ‌ها (با کاما جدا کن)</span>
            <input
              className="ios-input"
              value={form.tags}
              placeholder="عادت‌سازی، سلامت، بهره‌وری"
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
            />
          </label>

          {/* reading time + cover */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
            <label style={labelStyle}>
              <span>زمان مطالعه (دقیقه)</span>
              <input
                className="ios-input"
                type="number"
                min={1}
                max={60}
                value={form.reading_time}
                onChange={(e) => setForm((f) => ({ ...f, reading_time: e.target.value }))}
              />
            </label>
            <label style={labelStyle}>
              <span>آدرس تصویر کاور</span>
              <input
                className="ios-input"
                dir="ltr"
                value={form.cover_url}
                placeholder="https://..."
                onChange={(e) => setForm((f) => ({ ...f, cover_url: e.target.value }))}
              />
            </label>
          </div>

          {/* published */}
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={form.published}
              onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))}
              style={{ width: 18, height: 18, accentColor: "var(--blue)" }}
            />
            <span style={{ fontSize: 15 }}>منتشر شود</span>
          </label>

          {/* content */}
          <label style={labelStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span>محتوا (HTML)</span>
              <button
                className="ios-btn-ghost"
                style={{ fontSize: 13 }}
                type="button"
                onClick={() => setPreview((v) => !v)}
              >
                {preview ? "ویرایش" : "پیش‌نمایش"}
              </button>
            </div>
            {preview ? (
              <div
                className="blog-content"
                style={{
                  background: "var(--bg)",
                  borderRadius: "var(--r-sm)",
                  padding: 16,
                  minHeight: 300,
                  fontSize: 15,
                }}
                dangerouslySetInnerHTML={{ __html: form.content }}
              />
            ) : (
              <textarea
                className="ios-input"
                value={form.content}
                rows={16}
                placeholder="<h2>عنوان بخش</h2><p>متن مقاله...</p>"
                dir="rtl"
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                style={{ fontFamily: "monospace", fontSize: 13, resize: "vertical" }}
              />
            )}
          </label>

          {err && <p style={{ color: "var(--danger,#ff453a)", fontSize: 14 }}>{err}</p>}

          <button
            className="ios-btn"
            onClick={save}
            disabled={saving}
            style={{ marginTop: 4 }}
          >
            {saving ? "در حال ذخیره..." : editId ? "بروزرسانی" : "ایجاد مقاله"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <SectionTitle>{posts.length} مقاله</SectionTitle>
        <button className="ios-btn" onClick={openNew} style={{ fontSize: 14 }}>
          + مقاله جدید
        </button>
      </div>

      {posts.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--secondary)" }}>
          هنوز مقاله‌ای ثبت نشده.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {posts.map((p) => (
            <div key={p.id} className="card" style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                {/* status dot */}
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: p.published ? "var(--sage)" : "var(--secondary)",
                    flexShrink: 0,
                    marginTop: 6,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: "var(--ink)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: "100%",
                      }}
                    >
                      {p.title}
                    </span>
                    {p.published ? (
                      <span style={badge("var(--t-sage)", "var(--sage)")}>منتشرشده</span>
                    ) : (
                      <span style={badge("var(--t-grey)", "var(--secondary)")}>پیش‌نویس</span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 4, color: "var(--secondary)", fontSize: 12 }}>
                    <span dir="ltr">/blog/{p.slug}</span>
                    <span>·</span>
                    <span>{p.reading_time} دقیقه</span>
                    {p.tags?.length > 0 && (
                      <>
                        <span>·</span>
                        <span>{p.tags.slice(0, 2).join("، ")}</span>
                      </>
                    )}
                    {p.published_at && (
                      <>
                        <span>·</span>
                        <span>{persianDate(p.published_at)}</span>
                      </>
                    )}
                  </div>
                </div>
                {/* actions */}
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button className="ios-btn-ghost" style={{ fontSize: 13 }} onClick={() => openEdit(p)}>
                    ویرایش
                  </button>
                  <button
                    className="ios-btn-ghost"
                    style={{ fontSize: 13 }}
                    onClick={() => togglePublish(p)}
                  >
                    {p.published ? "پنهان" : "انتشار"}
                  </button>
                  {p.published && (
                    <a
                      href={`/blog/${p.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ios-btn-ghost"
                      style={{ fontSize: 13 }}
                    >
                      مشاهده
                    </a>
                  )}
                  <button
                    className="ios-btn-ghost"
                    style={{ fontSize: 13, color: "var(--danger,#ff453a)" }}
                    onClick={() => deletePost(p)}
                  >
                    حذف
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: 14,
  color: "var(--ink)",
  fontWeight: 600,
};

function badge(bg: string, color: string): React.CSSProperties {
  return {
    background: bg,
    color,
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: 999,
    flexShrink: 0,
  };
}
