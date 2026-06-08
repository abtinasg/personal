-- ============================================================
--  مهاجرت ۰۱۲ — محدودسازیِ ساختِ کاربرِ مهمان بر اساسِ IP
--
--  مسیرِ /api/auth/guest بدونِ احراز هویت یک کاربرِ واقعی می‌سازد. بدونِ سقف،
--  می‌شود با اسکریپت بی‌نهایت مهمان ساخت و سهمیه‌ی رایگانِ هوش مصنوعی را
--  (که per-user است) بی‌نهایت کرد → هزینه‌ی OpenRouter و تورّمِ دیتابیس.
--  این جدول هر ساختِ مهمان را با IP ثبت می‌کند تا در بازه‌ی کوتاه سقف بخورد.
--  افزایشی و بی‌خطر.
-- ============================================================

create table if not exists public.guest_signups (
  id         uuid primary key default gen_random_uuid(),
  ip         text not null,
  created_at timestamptz not null default now()
);

-- جست‌وجوی «چند مهمان از این IP در بازه‌ی اخیر» سریع باشد.
create index if not exists guest_signups_ip_time_idx
  on public.guest_signups (ip, created_at desc);

alter table public.guest_signups enable row level security;
