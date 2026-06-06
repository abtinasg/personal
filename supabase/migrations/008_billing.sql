-- ============================================================
--  کیفِ پولِ اعتباری + پرداختِ زرین‌پال + ریت‌لیمیتِ هوش مصنوعی
--  (همتای بخشِ پایانیِ supabase/schema.sql)
--
--  مدل: pay-as-you-go. کاربر کیفِ پولش را با زرین‌پال شارژ می‌کند و
--  هر فراخوانیِ AI اعتبار مصرف می‌کند. هر روز چند فراخوانیِ رایگان دارد
--  (پی‌وال) و یک سقفِ سختِ ضدِسوءاستفاده در هر دقیقه (محافظت).
-- ============================================================

-- ---------- کیفِ پولِ اعتبار ----------
create table if not exists public.wallets (
  user_id    uuid primary key references public.users(id) on delete cascade,
  credits    integer not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------- دفترِ کلِ اعتبار (شارژ + مصرف) برای شفافیت ----------
create table if not exists public.credit_ledger (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  delta         integer not null,                 -- + شارژ، − مصرف
  reason        text not null,                    -- purchase | coach_chat | meal_estimate | ...
  balance_after integer not null,
  created_at    timestamptz not null default now()
);
create index if not exists credit_ledger_user_idx on public.credit_ledger(user_id, created_at desc);

-- ---------- پرداخت‌های زرین‌پال ----------
create table if not exists public.payments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  authority  text unique,                          -- Authority زرین‌پال
  amount     integer not null,                     -- مبلغ به تومان
  credits    integer not null,                     -- اعتباری که شارژ می‌شود
  status     text not null default 'pending',      -- pending | paid | failed | canceled
  ref_id     text,                                 -- کدِ رهگیریِ زرین‌پال بعد از verify
  created_at timestamptz not null default now(),
  paid_at    timestamptz
);
create index if not exists payments_user_idx on public.payments(user_id, created_at desc);

-- ---------- رویدادهای مصرفِ AI (سهمیهٔ رایگانِ روزانه + سقفِ ضدِسوءاستفاده) ----------
create table if not exists public.ai_usage (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  endpoint   text not null,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_user_time_idx on public.ai_usage(user_id, created_at desc);

alter table public.wallets       enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.payments      enable row level security;
alter table public.ai_usage      enable row level security;

-- ---------- شارژِ اتمیکِ اعتبار (با upsert) + ثبت در دفترِ کل ----------
create or replace function public.add_credits(p_user uuid, p_amount int, p_reason text)
returns int language plpgsql as $$
declare new_bal int;
begin
  insert into public.wallets(user_id, credits) values (p_user, p_amount)
    on conflict (user_id) do update set credits = public.wallets.credits + p_amount,
                                        updated_at = now()
    returning credits into new_bal;
  insert into public.credit_ledger(user_id, delta, reason, balance_after)
    values (p_user, p_amount, p_reason, new_bal);
  return new_bal;
end $$;

-- ---------- مصرفِ اتمیکِ اعتبار؛ اگر کافی نباشد −1 برمی‌گرداند ----------
create or replace function public.spend_credit(p_user uuid, p_cost int, p_reason text)
returns int language plpgsql as $$
declare new_bal int;
begin
  update public.wallets set credits = credits - p_cost, updated_at = now()
    where user_id = p_user and credits >= p_cost
    returning credits into new_bal;
  if new_bal is null then return -1; end if;
  insert into public.credit_ledger(user_id, delta, reason, balance_after)
    values (p_user, -p_cost, p_reason, new_bal);
  return new_bal;
end $$;
