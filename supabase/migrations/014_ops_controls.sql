-- ============================================================
--  مهاجرت ۰۱۴ — کنترل‌های عملیاتی: فلگ/کلیدِ قطع + گزارشِ ممیزی
--
--  سه قابلیتِ به‌هم‌پیوسته:
--   ۱) feature_flags — سوییچ‌های زمانِ اجرا بدونِ دیپلوی. «کلیدهای قطع»
--      (kill switch) هم همین‌اند: ai_enabled / signups_enabled /
--      payments_enabled / maintenance_mode. هر فلگ enabled دارد و
--      یک value اختیاری (jsonb) برای پیکربندی (مثلِ سقفِ بودجه).
--   ۲) ai_daily_budget — پایشِ هزینه: اگر روشن باشد و خرجِ تخمینیِ امروزِ
--      هوش مصنوعی از value.toman بگذرد، کرانِ cost-guard کلیدِ ai_enabled
--      را خودکار می‌اندازد (و در ممیزی ثبت می‌کند).
--   ۳) audit_log — هر کنشِ حساسِ ادمین/سیستم (حذف، خروجی، تغییرِ فلگ،
--      قطعِ خودکار) با actor و IP ثبت می‌شود.
--
--  افزایشی و بی‌خطر. روی Arvan/Postgres اجرا کن.
-- ============================================================

-- ---------- فلگ‌ها / کلیدهای قطع ----------
create table if not exists public.feature_flags (
  key         text primary key,
  enabled     boolean not null default true,
  value       jsonb,                       -- پیکربندیِ اختیاری (مثلِ {"toman": 350000})
  description text,
  updated_by  text,
  updated_at  timestamptz not null default now()
);
alter table public.feature_flags enable row level security;

-- مقادیرِ پیش‌فرض (idempotent — اجرای دوباره بی‌خطر است).
insert into public.feature_flags (key, enabled, value, description) values
  ('ai_enabled',       true,  null,                 'هوش مصنوعیِ جوانه فعال است'),
  ('signups_enabled',  true,  null,                 'ثبت‌نام و ورودِ مهمان باز است'),
  ('payments_enabled', true,  null,                 'درگاهِ پرداخت باز است'),
  ('maintenance_mode', false, null,                 'حالتِ تعمیر — همه‌ی سرویس‌ها قطع'),
  ('ai_daily_budget',  false, '{"toman": 0}'::jsonb, 'سقفِ بودجه‌ی روزانه‌ی هوش مصنوعی (قطعِ خودکار)')
on conflict (key) do nothing;

-- ---------- گزارشِ ممیزی ----------
create table if not exists public.audit_log (
  id           uuid primary key default gen_random_uuid(),
  actor        text not null,               -- نامِ کاربریِ ادمین یا 'system'
  action       text not null,               -- delete_row | delete_user | export | set_flag | ai_auto_kill | ...
  target_table text,
  target_id    text,
  meta         jsonb,
  ip           text,
  created_at   timestamptz not null default now()
);
create index if not exists audit_log_time_idx on public.audit_log(created_at desc);
alter table public.audit_log enable row level security;
