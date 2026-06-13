-- ============================================================
--  مهاجرت ۰۱۸ — لاگِ ساخت‌یافته‌ی اپ (app_logs)
--
--  پاسخ به «چرا اپ گاهی کار نمی‌کند؟». console.log کانتینر بعد از
--  ری‌استارت می‌پرد و فیلترکردنش سخت است؛ این جدول هر خطا/هشدارِ
--  مهم را با زمینه‌ی کافی نگه می‌دارد تا از پنلِ مدیریت قابلِ دیدن باشد:
--   - level: error | warn | info
--   - scope: ai | server | auth | billing | sms | push | capture | ...
--   - event: نامِ ماشینیِ کوتاه (provider_error، timeout، ...)
--   - detail: jsonb — status، مدل، latency، پیامِ خطا و ...
--
--  نگه‌داری: کرانِ cost-guard ردیف‌های قدیمی‌تر از ۱۴ روز را پاک می‌کند
--  تا جدول بی‌نهایت بزرگ نشود.
--
--  افزایشی و بی‌خطر. روی Arvan/Postgres اجرا کن.
-- ============================================================

create table if not exists public.app_logs (
  id         uuid primary key default gen_random_uuid(),
  level      text not null default 'error',   -- error | warn | info
  scope      text not null,                   -- ai | server | auth | billing | sms | push | capture | ...
  event      text not null,                   -- provider_error | timeout | invalid_response | unhandled | ...
  message    text,                            -- پیامِ قابل‌خواندن برای انسان
  detail     jsonb not null default '{}'::jsonb,
  user_id    uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists app_logs_time_idx       on public.app_logs(created_at desc);
create index if not exists app_logs_scope_time_idx on public.app_logs(scope, created_at desc);
create index if not exists app_logs_level_time_idx on public.app_logs(level, created_at desc);
alter table public.app_logs enable row level security;
