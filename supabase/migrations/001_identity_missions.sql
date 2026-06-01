-- ============================================================
--  مهاجرت ۰۰۱ — هویت‌محور + ماموریت‌ها
--  این فایل افزایشی (additive) است؛ روی دیتابیسِ موجود هم بی‌خطر اجرا می‌شود.
--  Supabase → SQL Editor → اجرا کن.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- هویت‌ها (من می‌خوام چه آدمی بشم) ----------
create table if not exists public.identities (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  name       text not null,                 -- مثل: «آدم سالم و سرحال»
  statement  text,                          -- جمله‌ی هویتی: «من کسی‌ام که هر روز به بدنش می‌رسه»
  emoji      text not null default '🌟',
  color      text not null default '#0a84ff',
  archived   boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists identities_user_idx on public.identities(user_id);

-- ---------- اتصال عادت به هویت + جزئیات اتمیک ----------
alter table public.habits add column if not exists identity_id uuid references public.identities(id) on delete set null;
alter table public.habits add column if not exists cue         text;   -- نشانه/زمان: «بعد از بیدار شدن»
alter table public.habits add column if not exists min_version text;   -- نسخه‌ی حداقلی (قانون ۲ دقیقه)

-- ---------- ماموریت‌ها ----------
create table if not exists public.missions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  title        text not null,
  why          text,                         -- چرا این ماموریت برام مهمه
  emoji        text not null default '🚀',
  color        text not null default '#5e5ce6',
  identity_id  uuid references public.identities(id) on delete set null,
  start_on     date not null default current_date,
  end_on       date,
  target_label text,                          -- مثل: «کاهش وزن»
  target_value numeric,
  target_unit  text,                          -- مثل: «کیلوگرم»
  status       text not null default 'active', -- active | completed | abandoned
  created_at   timestamptz not null default now()
);
create index if not exists missions_user_idx on public.missions(user_id, status);

-- ---------- نقاط‌عطف ماموریت ----------
create table if not exists public.mission_milestones (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  mission_id  uuid not null references public.missions(id) on delete cascade,
  title       text not null,
  order_index int  not null default 0,
  reached_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists milestones_mission_idx on public.mission_milestones(mission_id, order_index);

-- ---------- اتصال عادت‌ها به ماموریت ----------
create table if not exists public.mission_habits (
  mission_id uuid not null references public.missions(id) on delete cascade,
  habit_id   uuid not null references public.habits(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  primary key (mission_id, habit_id)
);
create index if not exists mission_habits_user_idx on public.mission_habits(user_id);

-- ---------- RLS (همه از سمت سرور با service-role) ----------
alter table public.identities         enable row level security;
alter table public.missions           enable row level security;
alter table public.mission_milestones enable row level security;
alter table public.mission_habits     enable row level security;
