import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "یک‌درصد";
const BASE_URL  = process.env.NEXT_PUBLIC_BASE_URL  ?? "https://yekdarsad.ir";

type Post = {
  id: string;
  slug: string;
  title: string;
  seo_title: string | null;
  seo_description: string | null;
  content: string;
  cover_url: string | null;
  tags: string[];
  reading_time: number;
  published_at: string;
};

async function getPost(slug: string): Promise<Post | null> {
  const db = getServiceClient();
  const { data } = await db
    .from("blog_posts")
    .select("id, slug, title, seo_title, seo_description, content, cover_url, tags, reading_time, published_at")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  return (data as Post | null) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "نوشته پیدا نشد" };

  const title = post.seo_title ?? post.title;
  const description = post.seo_description ?? "";
  const url = `${BASE_URL}/blog/${post.slug}`;

  return {
    title: `${title} | ${APP_NAME}`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "article",
      locale: "fa_IR",
      siteName: APP_NAME,
      publishedTime: post.published_at,
      tags: post.tags,
      ...(post.cover_url ? { images: [{ url: post.cover_url, alt: title }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(post.cover_url ? { images: [post.cover_url] } : {}),
    },
  };
}

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
function tagColor(tag: string) { return TAG_COLORS[tag] ?? "var(--t-grey)"; }

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const url = `${BASE_URL}/blog/${post.slug}`;
  const title = post.seo_title ?? post.title;
  const description = post.seo_description ?? "";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    datePublished: post.published_at,
    dateModified: post.published_at,
    author: { "@type": "Organization", name: APP_NAME, url: BASE_URL },
    publisher: { "@type": "Organization", name: APP_NAME, url: BASE_URL },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    ...(post.cover_url ? { image: post.cover_url } : {}),
    keywords: post.tags.join(", "),
    inLanguage: "fa",
  };

  return (
    <div
      dir="rtl"
      style={{ background: "var(--bg)", minHeight: "100dvh", fontFamily: "var(--font-vazir, sans-serif)" }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

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
        <Link href="/blog" style={{ color: "var(--secondary)", textDecoration: "none", fontSize: 14 }}>
          ← بازگشت به بلاگ
        </Link>
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px 80px" }}>
        {/* breadcrumb */}
        <nav style={{ fontSize: 13, color: "var(--secondary)", marginBottom: 28, display: "flex", gap: 6, alignItems: "center" }}>
          <Link href="/" style={{ color: "var(--secondary)", textDecoration: "none" }}>خانه</Link>
          <span>›</span>
          <Link href="/blog" style={{ color: "var(--secondary)", textDecoration: "none" }}>بلاگ</Link>
          <span>›</span>
          <span style={{ color: "var(--ink)" }}>{post.title}</span>
        </nav>

        {/* tags */}
        {post.tags?.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
            {post.tags.map((t) => (
              <Link
                key={t}
                href={`/blog?tag=${encodeURIComponent(t)}`}
                style={{
                  background: tagColor(t),
                  color: "var(--ink)",
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "3px 12px",
                  borderRadius: 999,
                  textDecoration: "none",
                }}
              >
                {t}
              </Link>
            ))}
          </div>
        )}

        {/* title */}
        <h1
          style={{
            fontFamily: "var(--font-display, serif)",
            fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
            fontWeight: 700,
            color: "var(--ink)",
            lineHeight: 1.4,
            margin: "0 0 16px",
          }}
        >
          {post.title}
        </h1>

        {/* meta */}
        <div style={{ display: "flex", gap: 12, color: "var(--secondary)", fontSize: 13, marginBottom: 32 }}>
          <span>{post.reading_time} دقیقه مطالعه</span>
          <span>·</span>
          <time dateTime={post.published_at}>{persianDate(post.published_at)}</time>
        </div>

        {/* cover */}
        {post.cover_url && (
          <img
            src={post.cover_url}
            alt={post.title}
            style={{ width: "100%", borderRadius: "var(--r, 24px)", marginBottom: 36, display: "block" }}
          />
        )}

        {/* content */}
        <div
          className="blog-content"
          style={{ color: "var(--ink)" }}
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {/* CTA */}
        <div
          style={{
            marginTop: 56,
            background: "var(--ink)",
            borderRadius: "var(--r, 24px)",
            padding: "32px 28px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>🌱</div>
          <h3
            style={{
              fontFamily: "var(--font-display, serif)",
              color: "#fff",
              fontSize: 22,
              fontWeight: 700,
              margin: "0 0 8px",
            }}
          >
            همین امروز شروع کن
          </h3>
          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 14, margin: "0 0 24px" }}>
            جوانه، مربی هوشمند فارسیت، هر روز کنارته.
          </p>
          <Link
            href="/start"
            style={{
              display: "inline-block",
              background: "#fff",
              color: "var(--ink)",
              fontWeight: 700,
              fontSize: 15,
              padding: "12px 32px",
              borderRadius: 999,
              textDecoration: "none",
            }}
          >
            رایگان شروع کن
          </Link>
        </div>

        {/* back link */}
        <div style={{ marginTop: 40, textAlign: "center" }}>
          <Link href="/blog" style={{ color: "var(--secondary)", fontSize: 14, textDecoration: "underline" }}>
            ← بازگشت به همه مقالات
          </Link>
        </div>
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
