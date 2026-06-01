# Migration Instructions

## Step 1: Run Migration on Supabase

1. Go to https://app.supabase.com/project/iziivvqnecnxdjfkripl/sql/new
2. Copy and paste the following SQL:

```sql
-- افزودن فیلد رمز عبور به جدول users
alter table public.users add column if not exists password_hash text;

-- ایندکس برای کوئریهای سریع‌تر
create index if not exists users_username_idx on public.users(username);
```

3. Click "Run" button

## Step 2: Test the New Features

- Visit http://localhost:3001
- Toggle between "پسکی" (Passkey) and "رمز عبور" (Password) tabs
- Try registering with a password (min 6 characters)
- Try logging in with username and password

## What Was Added

- Password hashing using PBKDF2 (secure, industry-standard)
- `/api/auth/register/password` - Register with password
- `/api/auth/login/password` - Login with password
- Updated login UI with tab-based authentication method switching
- Both passkey and password users share the same session system
