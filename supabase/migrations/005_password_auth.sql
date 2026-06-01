-- افزودن فیلد رمز عبور به جدول users
alter table public.users add column password_hash text;

-- ایندکس برای کوئریهای سریع‌تر
create index if not exists users_username_idx on public.users(username);
