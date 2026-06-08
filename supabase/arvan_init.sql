-- ============================================================
--  امروز — اسکیمای کاملِ دیتابیس برای Arvan DBaaS (PostgreSQL 15+)
--  این فایل را یک‌بار در Arvan → DBaaS → SQL Editor اجرا کن.
--  ایمن و افزایشی است (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── کاربران ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  username     text        UNIQUE,
  phone        text        UNIQUE,
  display_name text,
  password_hash text,
  is_guest     boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_idx ON public.users(username);
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_idx    ON public.users(phone);

-- ── پروفایل ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id             uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  daily_calorie_goal  int         NOT NULL DEFAULT 2000,
  monthly_budget      numeric     NOT NULL DEFAULT 0,
  water_goal_ml       int         NOT NULL DEFAULT 2000,
  weight_goal         numeric,
  currency            text        NOT NULL DEFAULT 'تومان',
  height_cm           numeric,
  sex                 text,
  birth_year          int,
  activity_level      text        DEFAULT 'light',
  fitness_goal        text,
  fitness_level       text,
  workout_days        int         DEFAULT 3,
  workout_location    text        DEFAULT 'gym',
  workout_equipment   text,
  workout_minutes     int         DEFAULT 45,
  workout_limits      text,
  onboarded           boolean     NOT NULL DEFAULT false,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ── OTP ────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.phone_otps (
  phone        text        PRIMARY KEY,
  code_hash    text        NOT NULL,
  expires_at   timestamptz NOT NULL,
  attempts     int         NOT NULL DEFAULT 0,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── پسکی‌ها ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.credentials (
  id           text        PRIMARY KEY,
  user_id      uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  public_key   text        NOT NULL,
  counter      bigint      NOT NULL DEFAULT 0,
  transports   text[],
  device_type  text,
  backed_up    boolean     DEFAULT false,
  nickname     text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
CREATE INDEX IF NOT EXISTS credentials_user_idx ON public.credentials(user_id);

-- ── وعده‌ی غذایی ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meals (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  calories   int         NOT NULL DEFAULT 0,
  protein    numeric     DEFAULT 0,
  carbs      numeric     DEFAULT 0,
  fat        numeric     DEFAULT 0,
  meal_type  text        DEFAULT 'snack',
  eaten_on   date        NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS meals_user_date_idx ON public.meals(user_id, eaten_on);

-- ── تراکنش‌های مالی ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transactions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind        text        NOT NULL DEFAULT 'expense',
  amount      numeric     NOT NULL DEFAULT 0,
  category    text        DEFAULT 'سایر',
  note        text,
  occurred_on date        NOT NULL DEFAULT CURRENT_DATE,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tx_user_date_idx ON public.transactions(user_id, occurred_on);

-- ── سلامتی ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.health_metrics (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind        text        NOT NULL,
  value       numeric     NOT NULL DEFAULT 0,
  recorded_on date        NOT NULL DEFAULT CURRENT_DATE,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS health_user_idx ON public.health_metrics(user_id, kind, recorded_on);

-- ── عادت‌ها ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.habits (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name           text        NOT NULL,
  emoji          text        DEFAULT '✅',
  color          text        DEFAULT '#34c759',
  target_per_day int         NOT NULL DEFAULT 1,
  archived       boolean     NOT NULL DEFAULT false,
  identity_id    uuid,
  cue            text,
  min_version    text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS habits_user_idx ON public.habits(user_id);

CREATE TABLE IF NOT EXISTS public.habit_logs (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  habit_id   uuid        NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  done_on    date        NOT NULL DEFAULT CURRENT_DATE,
  count      int         NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (habit_id, done_on)
);
CREATE INDEX IF NOT EXISTS habit_logs_idx ON public.habit_logs(user_id, done_on);

-- ── حال و هوا ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.moods (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  score       int         NOT NULL DEFAULT 3,
  note        text,
  recorded_on date        NOT NULL DEFAULT CURRENT_DATE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, recorded_on)
);
CREATE INDEX IF NOT EXISTS moods_user_idx ON public.moods(user_id, recorded_on);

-- ── هویت‌ها ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.identities (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  statement  text,
  emoji      text        NOT NULL DEFAULT '🌟',
  color      text        NOT NULL DEFAULT '#0a84ff',
  archived   boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS identities_user_idx ON public.identities(user_id);

-- FK بعد از ساختنِ identities
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'habits' AND constraint_name = 'habits_identity_fk'
  ) THEN
    ALTER TABLE public.habits
      ADD CONSTRAINT habits_identity_fk
      FOREIGN KEY (identity_id) REFERENCES public.identities(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── ماموریت‌ها ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.missions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title        text        NOT NULL,
  why          text,
  emoji        text        NOT NULL DEFAULT '🚀',
  color        text        NOT NULL DEFAULT '#5e5ce6',
  identity_id  uuid        REFERENCES public.identities(id) ON DELETE SET NULL,
  start_on     date        NOT NULL DEFAULT CURRENT_DATE,
  end_on       date,
  target_label text,
  target_value numeric,
  target_unit  text,
  status       text        NOT NULL DEFAULT 'active',
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS missions_user_idx ON public.missions(user_id, status);

CREATE TABLE IF NOT EXISTS public.mission_milestones (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mission_id  uuid        NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  order_index int         NOT NULL DEFAULT 0,
  reached_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS milestones_mission_idx ON public.mission_milestones(mission_id, order_index);

CREATE TABLE IF NOT EXISTS public.mission_habits (
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  habit_id   uuid NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  PRIMARY KEY (mission_id, habit_id)
);
CREATE INDEX IF NOT EXISTS mission_habits_user_idx ON public.mission_habits(user_id);

-- ── جایزه‌ها ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rewards (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  emoji       text        NOT NULL DEFAULT 'gift',
  color       text        NOT NULL DEFAULT '#ff9f0a',
  streak_days int         NOT NULL DEFAULT 5,
  archived    boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rewards_user_idx ON public.rewards(user_id, archived);

CREATE TABLE IF NOT EXISTS public.reward_claims (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reward_id  uuid        NOT NULL REFERENCES public.rewards(id) ON DELETE CASCADE,
  claimed_on date        NOT NULL DEFAULT CURRENT_DATE,
  streak_at  int         NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reward_claims_idx ON public.reward_claims(user_id, reward_id, claimed_on);

-- ── برنامه‌ی ورزشی ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workout_plans (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_on       date        NOT NULL DEFAULT CURRENT_DATE,
  focus         text,
  intensity     text,
  total_minutes int         NOT NULL DEFAULT 0,
  plan          jsonb       NOT NULL,
  completed     boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, plan_on)
);
CREATE INDEX IF NOT EXISTS workout_plans_user_idx ON public.workout_plans(user_id, plan_on);

-- ── صفِ کارِ ساختِ برنامه‌ی ورزشی ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workout_jobs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_on     date        NOT NULL DEFAULT current_date,
  status      text        NOT NULL DEFAULT 'pending',   -- pending | done | error
  error_msg   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS workout_jobs_user_idx
  ON public.workout_jobs(user_id, created_at DESC);

-- ── اهدافِ خرید ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchase_goals (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title         text        NOT NULL,
  emoji         text        NOT NULL DEFAULT 'target',
  denom         text        NOT NULL DEFAULT 'toman',
  target_native numeric     NOT NULL DEFAULT 0,
  saved_toman   numeric     NOT NULL DEFAULT 0,
  target_date   date,
  note          text,
  status        text        NOT NULL DEFAULT 'active',
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS purchase_goals_user_idx ON public.purchase_goals(user_id, status);

-- ── کیفِ پول و پرداخت ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wallets (
  user_id    uuid    PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  credits    integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  delta         integer     NOT NULL,
  reason        text        NOT NULL,
  balance_after integer     NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS credit_ledger_user_idx ON public.credit_ledger(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.payments (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  authority  text        UNIQUE,
  amount     integer     NOT NULL,
  credits    integer     NOT NULL,
  plan       text,
  cycle      text,
  status     text        NOT NULL DEFAULT 'pending',
  ref_id     text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at    timestamptz
);
CREATE INDEX IF NOT EXISTS payments_user_idx ON public.payments(user_id, created_at DESC);

-- ── مصرفِ AI ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint   text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_usage_user_time_idx ON public.ai_usage(user_id, created_at DESC);

-- ── اشتراک ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  user_id    uuid        PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  plan       text        NOT NULL,
  cycle      text        NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscriptions_expiry_idx ON public.subscriptions(expires_at);

-- ── نوتیفیکیشنِ وب ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  endpoint   text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_subs_user_idx ON public.push_subscriptions(user_id);

-- ── محدودسازیِ ساختِ کاربرِ مهمان بر اساسِ IP (ضدِسوءاستفاده / کنترلِ هزینه) ──────
CREATE TABLE IF NOT EXISTS public.guest_signups (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip         text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS guest_signups_ip_time_idx ON public.guest_signups (ip, created_at DESC);

-- ── توابعِ اتمیک ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.add_credits(p_user uuid, p_amount int, p_reason text)
RETURNS int LANGUAGE plpgsql AS $$
DECLARE new_bal int;
BEGIN
  INSERT INTO public.wallets(user_id, credits)
    VALUES (p_user, p_amount)
    ON CONFLICT (user_id) DO UPDATE
      SET credits = public.wallets.credits + p_amount, updated_at = now()
    RETURNING credits INTO new_bal;
  INSERT INTO public.credit_ledger(user_id, delta, reason, balance_after)
    VALUES (p_user, p_amount, p_reason, new_bal);
  RETURN new_bal;
END $$;

CREATE OR REPLACE FUNCTION public.spend_credit(p_user uuid, p_cost int, p_reason text)
RETURNS int LANGUAGE plpgsql AS $$
DECLARE new_bal int;
BEGIN
  UPDATE public.wallets
    SET credits = credits - p_cost, updated_at = now()
    WHERE user_id = p_user AND credits >= p_cost
    RETURNING credits INTO new_bal;
  IF new_bal IS NULL THEN RETURN -1; END IF;
  INSERT INTO public.credit_ledger(user_id, delta, reason, balance_after)
    VALUES (p_user, -p_cost, p_reason, new_bal);
  RETURN new_bal;
END $$;

CREATE OR REPLACE FUNCTION public.activate_subscription(
  p_user uuid, p_plan text, p_cycle text, p_days int
) RETURNS timestamptz LANGUAGE plpgsql AS $$
DECLARE base timestamptz; new_exp timestamptz;
BEGIN
  SELECT expires_at INTO base FROM public.subscriptions WHERE user_id = p_user;
  IF base IS NULL OR base < now() THEN base := now(); END IF;
  new_exp := base + make_interval(days => p_days);
  INSERT INTO public.subscriptions(user_id, plan, cycle, expires_at, updated_at)
    VALUES (p_user, p_plan, p_cycle, new_exp, now())
    ON CONFLICT (user_id) DO UPDATE
      SET plan = EXCLUDED.plan, cycle = EXCLUDED.cycle,
          expires_at = EXCLUDED.expires_at, updated_at = now();
  RETURN new_exp;
END $$;
