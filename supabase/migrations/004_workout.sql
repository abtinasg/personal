-- ============================================================
--  مهاجرت ۰۰۴ — برنامه‌ی ورزشی هوشمند (هوازی + قدرتی)
--  افزایشی و بی‌خطر روی دیتابیسِ موجود.
--  Supabase → SQL Editor → اجرا کن.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- ترجیحاتِ ورزشی روی پروفایل ----------
alter table public.profiles add column if not exists fitness_goal      text;            -- lose_fat | build_muscle | strength | endurance | general
alter table public.profiles add column if not exists fitness_level     text;            -- beginner | intermediate | advanced
alter table public.profiles add column if not exists workout_days      int  default 3;  -- تعداد جلسه در هفته
alter table public.profiles add column if not exists workout_location  text default 'gym'; -- gym | home | outdoor
alter table public.profiles add column if not exists workout_equipment text;            -- تجهیزات در دسترس (آزاد)
alter table public.profiles add column if not exists workout_minutes   int  default 45; -- مدتِ دلخواهِ هر جلسه (دقیقه)
alter table public.profiles add column if not exists workout_limits    text;            -- آسیب/محدودیت (اختیاری)

-- ---------- برنامه‌ی روزانه‌ی ساخته‌شده توسط هوش مصنوعی ----------
create table if not exists public.workout_plans (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  plan_on       date not null default current_date,
  focus         text,                              -- مثل «بالاتنه — هل‌دادن» یا «هوازی + کل‌بدن»
  intensity     text,                              -- سبک | متوسط | سنگین
  total_minutes int  not null default 0,
  plan          jsonb not null,                    -- کلِ برنامه (بلوک‌ها، حرکت‌ها، نکته‌ها)
  completed     boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (user_id, plan_on)
);
create index if not exists workout_plans_user_idx on public.workout_plans(user_id, plan_on);

-- ---------- RLS (همه از سمت سرور با service-role) ----------
alter table public.workout_plans enable row level security;
