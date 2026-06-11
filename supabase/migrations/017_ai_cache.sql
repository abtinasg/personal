-- ============================================================
--  مهاجرت ۰۱۷ — کَشِ پاسخ‌های هوش مصنوعی
--  پاسخ‌های AI بر اساس کلید + تاریخ انقضا در اینجا نگهداری می‌شوند.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_cache (
  cache_key  text        PRIMARY KEY,
  value      jsonb       NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_cache_expires
  ON public.ai_cache (expires_at);
