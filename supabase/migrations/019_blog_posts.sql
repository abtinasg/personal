-- مقالاتِ بلاگِ عمومی
CREATE TABLE IF NOT EXISTS blog_posts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT        UNIQUE NOT NULL,
  title           TEXT        NOT NULL,
  seo_title       TEXT,
  seo_description TEXT,
  content         TEXT        NOT NULL DEFAULT '',
  cover_url       TEXT,
  tags            TEXT[]      NOT NULL DEFAULT '{}',
  reading_time    INT         NOT NULL DEFAULT 3,
  published       BOOLEAN     NOT NULL DEFAULT FALSE,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS blog_posts_slug_idx ON blog_posts (slug);
CREATE INDEX IF NOT EXISTS blog_posts_pub_idx  ON blog_posts (published_at DESC) WHERE published = TRUE;
