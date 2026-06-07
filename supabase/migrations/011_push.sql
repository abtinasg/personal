-- ============================================================
--  مهاجرت ۰۱۱ — اشتراکِ نوتیفیکیشنِ وب (Web Push)
--
--  هر دستگاه/مرورگرِ کاربر یک endpoint یکتا دارد. کلیدهای p256dh و auth
--  برای رمزنگاریِ پیام لازم‌اند. مربی «جوانه» از طریقِ این‌ها پیام می‌فرستد.
--  افزایشی و بی‌خطر. Supabase → SQL Editor → اجرا کن.
-- ============================================================

create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null references public.users(id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subs_user_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
