-- ============================================================
--  زندگی — اسکیمای دیتابیس Supabase
--  این فایل رو در Supabase → SQL Editor اجرا کن.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- کاربران ----------
create table if not exists public.users (
  id           uuid primary key default gen_random_uuid(),
  username     text unique not null,
  display_name text,
  created_at   timestamptz not null default now()
);

-- ---------- پسکی‌ها (WebAuthn credentials) ----------
create table if not exists public.credentials (
  id            text primary key,                 -- credentialID (base64url)
  user_id       uuid not null references public.users(id) on delete cascade,
  public_key    text not null,                    -- public key (base64url)
  counter       bigint not null default 0,
  transports    text[],
  device_type   text,
  backed_up     boolean default false,
  nickname      text,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);
create index if not exists credentials_user_idx on public.credentials(user_id);

-- ---------- تنظیمات / پروفایل ----------
create table if not exists public.profiles (
  user_id            uuid primary key references public.users(id) on delete cascade,
  daily_calorie_goal int  not null default 2000,
  monthly_budget     numeric not null default 0,
  water_goal_ml      int  not null default 2000,
  weight_goal        numeric,
  currency           text not null default 'تومان',
  height_cm          numeric,
  sex                text,
  birth_year         int,
  activity_level     text default 'light',
  -- ترجیحاتِ ورزشی (همتای supabase/migrations/004)
  fitness_goal       text,
  fitness_level      text,
  workout_days       int  default 3,
  workout_location   text default 'gym',
  workout_equipment  text,
  workout_minutes    int  default 45,
  workout_limits     text,
  updated_at         timestamptz not null default now()
);

-- ---------- کالری‌شمار ----------
create table if not exists public.meals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  name       text not null,
  calories   int  not null default 0,
  protein    numeric default 0,
  carbs      numeric default 0,
  fat        numeric default 0,
  meal_type  text default 'snack',  -- breakfast | lunch | dinner | snack
  eaten_on   date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists meals_user_date_idx on public.meals(user_id, eaten_on);

-- ---------- بودجه و خرج ----------
create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  kind        text not null default 'expense',   -- income | expense
  amount      numeric not null default 0,
  category    text default 'سایر',
  note        text,
  occurred_on date not null default current_date,
  created_at  timestamptz not null default now()
);
create index if not exists tx_user_date_idx on public.transactions(user_id, occurred_on);

-- ---------- سلامتی ----------
create table if not exists public.health_metrics (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  kind        text not null,        -- weight | water | sleep | steps
  value       numeric not null default 0,
  recorded_on date not null default current_date,
  created_at  timestamptz not null default now()
);
create index if not exists health_user_idx on public.health_metrics(user_id, kind, recorded_on);

-- ---------- عادت‌ها ----------
create table if not exists public.habits (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users(id) on delete cascade,
  name           text not null,
  emoji          text default '✅',
  color          text default '#34c759',
  target_per_day int not null default 1,
  archived       boolean not null default false,
  created_at     timestamptz not null default now()
);
create index if not exists habits_user_idx on public.habits(user_id);

create table if not exists public.habit_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  habit_id   uuid not null references public.habits(id) on delete cascade,
  done_on    date not null default current_date,
  count      int  not null default 1,
  created_at timestamptz not null default now(),
  unique (habit_id, done_on)
);
create index if not exists habit_logs_idx on public.habit_logs(user_id, done_on);

-- ---------- حال و حوصله (mood) ----------
create table if not exists public.moods (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  score       int  not null default 3,   -- 1..5
  note        text,
  recorded_on date not null default current_date,
  created_at  timestamptz not null default now(),
  unique (user_id, recorded_on)
);
create index if not exists moods_user_idx on public.moods(user_id, recorded_on);

-- ============================================================
--  RLS: همه‌ی دسترسی‌ها از سمت سرور با service-role انجام می‌شه
--  (که RLS رو دور می‌زنه). با فعال‌کردن RLS و نبودِ policy،
--  کلید anon هیچ دسترسی‌ای نداره — امن‌ترین حالت پیش‌فرض.
-- ============================================================
alter table public.users          enable row level security;
alter table public.credentials    enable row level security;
alter table public.profiles       enable row level security;
alter table public.meals          enable row level security;
alter table public.transactions   enable row level security;
alter table public.health_metrics enable row level security;
alter table public.habits         enable row level security;
alter table public.habit_logs     enable row level security;
alter table public.moods          enable row level security;

-- ============================================================
--  هویت‌محور + ماموریت‌ها  (همتای supabase/migrations/001)
-- ============================================================

create table if not exists public.identities (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  name       text not null,
  statement  text,
  emoji      text not null default '🌟',
  color      text not null default '#0a84ff',
  archived   boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists identities_user_idx on public.identities(user_id);

alter table public.habits add column if not exists identity_id uuid references public.identities(id) on delete set null;
alter table public.habits add column if not exists cue         text;
alter table public.habits add column if not exists min_version text;

create table if not exists public.missions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  title        text not null,
  why          text,
  emoji        text not null default '🚀',
  color        text not null default '#5e5ce6',
  identity_id  uuid references public.identities(id) on delete set null,
  start_on     date not null default current_date,
  end_on       date,
  target_label text,
  target_value numeric,
  target_unit  text,
  status       text not null default 'active',
  created_at   timestamptz not null default now()
);
create index if not exists missions_user_idx on public.missions(user_id, status);

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

create table if not exists public.mission_habits (
  mission_id uuid not null references public.missions(id) on delete cascade,
  habit_id   uuid not null references public.habits(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  primary key (mission_id, habit_id)
);
create index if not exists mission_habits_user_idx on public.mission_habits(user_id);

alter table public.identities         enable row level security;
alter table public.missions           enable row level security;
alter table public.mission_milestones enable row level security;
alter table public.mission_habits     enable row level security;

-- ============================================================
--  جایزه‌ها  (همتای supabase/migrations/003)
-- ============================================================

create table if not exists public.rewards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  title       text not null,
  emoji       text not null default 'gift',
  color       text not null default '#ff9f0a',
  streak_days int  not null default 5,
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists rewards_user_idx on public.rewards(user_id, archived);

create table if not exists public.reward_claims (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  reward_id   uuid not null references public.rewards(id) on delete cascade,
  claimed_on  date not null default current_date,
  streak_at   int  not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists reward_claims_idx on public.reward_claims(user_id, reward_id, claimed_on);

alter table public.rewards       enable row level security;
alter table public.reward_claims enable row level security;

-- ============================================================
--  برنامه‌ی ورزشی  (همتای supabase/migrations/004)
-- ============================================================

create table if not exists public.workout_plans (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  plan_on       date not null default current_date,
  focus         text,
  intensity     text,
  total_minutes int  not null default 0,
  plan          jsonb not null,
  completed     boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (user_id, plan_on)
);
create index if not exists workout_plans_user_idx on public.workout_plans(user_id, plan_on);

alter table public.workout_plans enable row level security;
