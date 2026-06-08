-- ============================================================
--  مهاجرت ۰۱۳ — رویدادها (analytics) + ویوی فعالیت برای داشبوردِ مدیریت
--
--  دو چیز اضافه می‌کند:
--   ۱) جدولِ events — قیفِ محصول و رویدادهای سمتِ سرور (مهمان، ثبت‌نام،
--      شروعِ پرداخت، پرداختِ موفق، بستنِ پنجره‌ی OTP، خطای هوش مصنوعی).
--      بدونِ این جدول، «کجا کاربر ریزش می‌کند» قابلِ اندازه‌گیری نیست.
--   ۲) ویوی v_activity — اجتماعِ هر «نوشتنِ» کاربر در اپ. مبنای DAU/WAU/MAU
--      و منحنیِ ماندگاری (retention) است، بدونِ نیاز به ابزارِ بیرونی.
--
--  افزایشی و بی‌خطر. روی Arvan/Postgres اجرا کن.
-- ============================================================

create table if not exists public.events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.users(id) on delete set null,
  name       text not null,            -- guest_start | signup | checkout_start | payment_paid | otp_closed | ai_error | ...
  props      jsonb not null default '{}'::jsonb,
  ip         text,
  created_at timestamptz not null default now()
);
create index if not exists events_name_time_idx on public.events(name, created_at desc);
create index if not exists events_time_idx       on public.events(created_at desc);
create index if not exists events_user_idx       on public.events(user_id, created_at desc);
alter table public.events enable row level security;

-- ---------- ویوی فعالیتِ کاربر (مبنای DAU/WAU/MAU و ماندگاری) ----------
-- هر ردیف یعنی «کاربری در این لحظه کاری در اپ انجام داد».
create or replace view public.v_activity as
  select user_id, created_at from public.ai_usage
  union all select user_id, created_at from public.meals
  union all select user_id, created_at from public.transactions
  union all select user_id, created_at from public.health_metrics
  union all select user_id, created_at from public.habit_logs
  union all select user_id, created_at from public.moods;
