import type { Metadata } from "next";
import Link from "next/link";
import { getServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "یک‌درصد";
const BASE_URL  = process.env.NEXT_PUBLIC_BASE_URL  ?? "https://yekdarsad.ir";

export const metadata: Metadata = {
  title: `بلاگ | ${APP_NAME}`,
  description: "مقالاتی درباره‌ی عادت‌سازی، سبک زندگی، سلامت، و بهره‌وری روزانه",
  alternates: { canonical: `${BASE_URL}/blog` },
  openGraph: {
    title: `بلاگ ${APP_NAME}`,
    description: "مقالاتی درباره‌ی عادت‌سازی، سبک زندگی، سلامت، و بهره‌وری روزانه",
    url: `${BASE_URL}/blog`,
    type: "website",
    locale: "fa_IR",
    siteName: APP_NAME,
  },
};

type Post = {
  id: string;
  slug: string;
  title: string;
  seo_description: string | null;
  cover_url: string | null;
  tags: string[];
  reading_time: number;
  published_at: string;
};

function persianDate(iso: string) {
  return new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "long", day: "numeric" }).format(
    new Date(iso)
  );
}

const TAG_COLORS: Record<string, string> = {
  "عادت‌سازی": "var(--t-sage)",
  "سلامت":     "var(--t-blue)",
  "بهره‌وری":  "var(--t-lav)",
  "تغذیه":     "var(--t-peach)",
  "ورزش":      "var(--t-rose)",
  "بودجه":     "var(--t-yellow)",
};

function tagColor(tag: string) {
  return TAG_COLORS[tag] ?? "var(--t-grey)";
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; page?: string }>;
}) {
  const { tag, page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1"));
  const per  = 20;
  const offset = (page - 1) * per;

  const db = getServiceClient();
  let posts: Post[] = [];
  let total = 0;

  try {
    if (tag) {
      const [countRes, dataRes] = await Promise.all([
        db.query<{ count: string }>(
          `SELECT COUNT(*) AS count FROM blog_posts WHERE published = true AND $1 = ANY(tags)`,
          [tag]
        ),
        db.query<Post>(
          `SELECT id, slug, title, seo_description, cover_url, tags, reading_time, published_at
           FROM blog_posts WHERE published = true AND $1 = ANY(tags)
           ORDER BY published_at DESC LIMIT $2 OFFSET $3`,
          [tag, per, offset]
        ),
      ]);
      total = Number(countRes[0]?.count ?? 0);
      posts = dataRes;
    } else {
      const { data, count } = await db
        .from("blog_posts")
        .select("id, slug, title, seo_description, cover_url, tags, reading_time, published_at", {
          count: "exact",
        })
        .eq("published", true)
        .order("published_at", { ascending: false })
        .range(offset, offset + per - 1);
      posts = (data ?? []) as Post[];
      total = count ?? 0;
    }
  } catch {
    posts = [];
  }

  const totalPages = Math.ceil(total / per);

  return (
    <div
      dir="rtl"
      style={{ background: "var(--bg)", minHeight: "100dvh", fontFamily: "var(--font-vazir, sans-serif)" }}
    >
      {/* header */}
      <header
        style={{
          background: "var(--card)",
          borderBottom: "1px solid var(--line)",
          padding: "0 24px",
          height: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <Link
          href="/"
          style={{ fontFamily: "var(--font-display, serif)", fontSize: 22, fontWeight: 700, color: "var(--ink)", textDecoration: "none" }}
        >
          {APP_NAME} 🌱
        </Link>
        <nav style={{ display: "flex", gap: 20 }}>
          <Link href="/blog" style={{ color: "var(--blue)", textDecoration: "none", fontWeight: 600, fontSize: 15 }}>
            بلاگ
          </Link>
          <Link href="/start" style={{ color: "var(--secondary)", textDecoration: "none", fontSize: 15 }}>
            دانلود اپ
          </Link>
        </nav>
      </header>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px 80px" }}>
        {/* hero */}
        <div style={{ marginBottom: 40 }}>
          <h1
            style={{
              fontFamily: "var(--font-display, serif)",
              fontSize: "clamp(2rem, 5vw, 3rem)",
              fontWeight: 700,
              color: "var(--ink)",
              margin: "0 0 12px",
              lineHeight: 1.3,
            }}
          >
            بلاگ {APP_NAME}
          </h1>
          <p style={{ color: "var(--secondary)", fontSize: 16, margin: 0 }}>
            مقالاتی درباره‌ی عادت‌سازی، سلامت، بهره‌وری، و زندگیِ بهتر
          </p>
        </div>

        {/* active tag filter */}
        {tag && (
          <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 14, color: "var(--secondary)" }}>فیلتر:</span>
            <span
              style={{
                background: tagColor(tag),
                color: "var(--ink)",
                fontSize: 13,
                fontWeight: 600,
                padding: "4px 12px",
                borderRadius: 999,
              }}
            >
              {tag}
            </span>
            <Link
              href="/blog"
              style={{ fontSize: 13, color: "var(--secondary)", textDecoration: "underline" }}
            >
              حذف فیلتر
            </Link>
          </div>
        )}

        {/* grid */}
        {posts.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--secondary)", padding: "60px 0" }}>
            هنوز مقاله‌ای منتشر نشده.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 20,
              marginBottom: 48,
            }}
          >
            {posts.map((post) => (
              <Link key={post.id} href={`/blog/${post.slug}`} style={{ textDecoration: "none" }}>
                <article
                  style={{
                    background: "var(--card)",
                    borderRadius: "var(--r, 24px)",
                    overflow: "hidden",
                    boxShadow: "var(--sh-sm)",
                    transition: "transform .2s, box-shadow .2s",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                    (e.currentTarget as HTMLElement).style.boxShadow = "var(--sh)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = "";
                    (e.currentTarget as HTMLElement).style.boxShadow = "var(--sh-sm)";
                  }}
                >
                  {post.cover_url && (
                    <img
                      src={post.cover_url}
                      alt={post.title}
                      style={{ width: "100%", height: 180, objectFit: "cover" }}
                    />
                  )}
                  <div style={{ padding: "18px 20px 20px", flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                    {/* tags */}
                    {post.tags?.length > 0 && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {post.tags.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            style={{
                              background: tagColor(t),
                              color: "var(--ink)",
                              fontSize: 11,
                              fontWeight: 600,
                              padding: "2px 10px",
                              borderRadius: 999,
                            }}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* title */}
                    <h2
                      style={{
                        fontFamily: "var(--font-display, serif)",
                        fontSize: 18,
                        fontWeight: 700,
                        color: "var(--ink)",
                        margin: 0,
                        lineHeight: 1.5,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {post.title}
                    </h2>

                    {/* description */}
                    {post.seo_description && (
                      <p
                        style={{
                          color: "var(--secondary)",
                          fontSize: 14,
                          lineHeight: 1.7,
                          margin: 0,
                          flex: 1,
                          display: "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {post.seo_description}
                      </p>
                    )}

                    {/* meta */}
                    <div style={{ display: "flex", gap: 10, color: "var(--secondary)", fontSize: 12, marginTop: "auto" }}>
                      <span>{post.reading_time} دقیقه مطالعه</span>
                      <span>·</span>
                      <span>{persianDate(post.published_at)}</span>
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}

        {/* pagination */}
        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
            {page > 1 && (
              <Link
                href={`/blog?page=${page - 1}${tag ? `&tag=${encodeURIComponent(tag)}` : ""}`}
                style={paginBtn}
              >
                ‹ قبلی
              </Link>
            )}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => Math.abs(p - page) <= 2)
              .map((p) => (
                <Link
                  key={p}
                  href={`/blog?page=${p}${tag ? `&tag=${encodeURIComponent(tag)}` : ""}`}
                  style={{
                    ...paginBtn,
                    background: p === page ? "var(--ink)" : "var(--card)",
                    color: p === page ? "#fff" : "var(--ink)",
                  }}
                >
                  {p}
                </Link>
              ))}
            {page < totalPages && (
              <Link
                href={`/blog?page=${page + 1}${tag ? `&tag=${encodeURIComponent(tag)}` : ""}`}
                style={paginBtn}
              >
                بعدی ›
              </Link>
            )}
          </div>
        )}
      </main>

      <footer
        style={{
          borderTop: "1px solid var(--line)",
          textAlign: "center",
          padding: "24px 20px",
          color: "var(--secondary)",
          fontSize: 13,
        }}
      >
        © {new Date().getFullYear()} {APP_NAME} · ساخته‌شده با ❤️ در ایران
      </footer>
    </div>
  );
}

const paginBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 40,
  height: 40,
  borderRadius: 12,
  background: "var(--card)",
  color: "var(--ink)",
  fontSize: 14,
  fontWeight: 600,
  textDecoration: "none",
  boxShadow: "var(--sh-sm)",
  padding: "0 12px",
};
