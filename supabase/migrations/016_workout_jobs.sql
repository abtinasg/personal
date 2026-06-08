-- ============================================================
--  مهاجرت ۰۱۶ — صفِ کارِ ساختِ برنامه‌ی ورزشی (async generation)
--  هر بار که کاربر دکمه‌ی «ساخت برنامه» را می‌زند یک job ثبت می‌شود،
--  پردازش در پس‌زمینه انجام می‌شود و کاربر وضعیت را polling می‌کند.
--  این الگو timeout پراکسیِ Arvan را دور می‌زند.
-- ============================================================

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
