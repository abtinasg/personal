-- ============================================================
--  سرمایه‌گذاری و هدف خرید  (همتای بخش پایانیِ supabase/schema.sql)
--  بخش «بودجه» به یک فضای یادگیریِ سرمایه‌گذاری تبدیل می‌شود:
--  کاربر هدف خرید می‌گذارد و هدف را برحسبِ دارایی (دلار/طلا/سکه)
--  نگه می‌داریم تا تورم آن را بی‌اثر نکند.
-- ============================================================

create table if not exists public.purchase_goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  title         text not null,
  emoji         text not null default 'target',
  -- واحدِ هدف: toman (تومان) | usd (دلار) | gold (گرم طلای ۱۸) | coin (سکه‌ی امامی)
  denom         text not null default 'toman',
  -- مقدارِ هدف بر حسبِ همان واحد (مثلاً ۵۰۰ دلار، ۱۰ گرم، ۲ سکه، ۵۰٬۰۰۰٬۰۰۰ تومان)
  target_native numeric not null default 0,
  -- مبلغی که کاربر تا حالا کنار گذاشته (همیشه به تومان)
  saved_toman   numeric not null default 0,
  target_date   date,
  note          text,
  -- وضعیت: active (فعال) | reached (رسیده) | archived (بایگانی)
  status        text not null default 'active',
  created_at    timestamptz not null default now()
);
create index if not exists purchase_goals_user_idx on public.purchase_goals(user_id, status);

alter table public.purchase_goals enable row level security;
