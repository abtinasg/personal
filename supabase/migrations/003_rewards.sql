-- ============================================================
--  مهاجرت ۰۰۳ — جایزه‌ها (پاداشِ روزهای پیاپیِ عالی)
--  افزایشی و بی‌خطر روی دیتابیسِ موجود.
--  Supabase → SQL Editor → اجرا کن.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- جایزه‌ها (چیزِ هیجان‌انگیزی که با ثباتِ چندروزه برای خودت باز می‌کنی) ----------
create table if not exists public.rewards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  title       text not null,                 -- مثل: «یه قسمت از سریالِ موردعلاقه‌ت»
  emoji       text not null default 'gift',
  color       text not null default '#ff9f0a',
  streak_days int  not null default 5,        -- چند روزِ پیاپیِ عالی لازمه تا باز شه
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists rewards_user_idx on public.rewards(user_id, archived);

-- ---------- دریافتِ جایزه (هربار که جایزه رو می‌گیری) ----------
create table if not exists public.reward_claims (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  reward_id   uuid not null references public.rewards(id) on delete cascade,
  claimed_on  date not null default current_date,
  streak_at   int  not null default 0,        -- استریک در لحظه‌ی دریافت
  created_at  timestamptz not null default now()
);
create index if not exists reward_claims_idx on public.reward_claims(user_id, reward_id, claimed_on);

-- ---------- RLS (همه از سمت سرور با service-role) ----------
alter table public.rewards       enable row level security;
alter table public.reward_claims enable row level security;
