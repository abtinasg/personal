-- ============================================================
--  ورود با شماره موبایل + کد یک‌بارمصرف (OTP) — کاوه‌نگار
--  این فایل را در Supabase → SQL Editor اجرا کن.
-- ============================================================

-- ---------- موبایل روی کاربر ----------
alter table public.users add column if not exists phone text;
-- از این پس username اختیاری است (ورود فقط با موبایل انجام می‌شود)
alter table public.users alter column username drop not null;

create unique index if not exists users_phone_idx on public.users(phone);

-- ---------- کدهای یک‌بارمصرف ----------
-- برای هر شماره فقط یک کدِ فعال نگه می‌داریم (phone کلید اصلی است).
create table if not exists public.phone_otps (
  phone        text primary key,
  code_hash    text not null,            -- sha256(code) — کد خام ذخیره نمی‌شود
  expires_at   timestamptz not null,
  attempts     int  not null default 0,  -- شمارش تلاش‌های نادرستِ تأیید
  last_sent_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

alter table public.phone_otps enable row level security;
