-- ============================================================
--  مهاجرت ۰۰۹ — اشتراکِ پلن‌محور (پلاس/پرو)
--
--  مدل: درگاه‌های ایرانی auto-debit ندارند، پس «تکرارشونده» یعنی
--  اشتراک با تاریخِ انقضا که کاربر دستی تمدید می‌کند. هر پرداختِ موفق،
--  انقضا را به‌اندازه‌ی دوره (۳۰/۳۶۵ روز) جلو می‌برد (تمدید، تمدید را اضافه می‌کند).
--  گِیتینگِ هوش مصنوعی از روی اشتراک انجام می‌شود؛ اعتبارِ کیفِ پول
--  به‌عنوانِ fallbackِ کاربرانِ بدونِ اشتراک باقی می‌ماند.
--  افزایشی و بی‌خطر. Supabase → SQL Editor → اجرا کن.
-- ============================================================

create table if not exists public.subscriptions (
  user_id    uuid primary key references public.users(id) on delete cascade,
  plan       text not null,          -- plus | pro
  cycle      text not null,          -- monthly | annual
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_expiry_idx on public.subscriptions(expires_at);
alter table public.subscriptions enable row level security;

-- روی پرداخت‌ها هم پلن/دوره را نگه می‌داریم تا callback بداند چه چیزی را فعال کند.
alter table public.payments add column if not exists plan  text;
alter table public.payments add column if not exists cycle text;

-- ---------- فعال‌سازی/تمدیدِ اتمیکِ اشتراک ----------
-- اگر اشتراکِ فعالی هست، از انقضای فعلی جلو می‌رود؛ وگرنه از now().
create or replace function public.activate_subscription(
  p_user uuid, p_plan text, p_cycle text, p_days int
) returns timestamptz language plpgsql as $$
declare base timestamptz; new_exp timestamptz;
begin
  select expires_at into base from public.subscriptions where user_id = p_user;
  if base is null or base < now() then base := now(); end if;
  new_exp := base + make_interval(days => p_days);
  insert into public.subscriptions(user_id, plan, cycle, expires_at, updated_at)
    values (p_user, p_plan, p_cycle, new_exp, now())
    on conflict (user_id) do update
      set plan = excluded.plan, cycle = excluded.cycle,
          expires_at = excluded.expires_at, updated_at = now();
  return new_exp;
end $$;
