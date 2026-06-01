-- ============================================================
--  مهاجرت ۰۰۲ — مشخصات بدنی برای محاسبه‌ی هوشمند BMI/کالری
--  افزایشی و بی‌خطر روی دیتابیس موجود.
--  Supabase → SQL Editor → اجرا کن.
-- ============================================================

alter table public.profiles add column if not exists height_cm      numeric;          -- قد به سانتی‌متر
alter table public.profiles add column if not exists sex            text;             -- 'male' | 'female'
alter table public.profiles add column if not exists birth_year     int;              -- سال تولد میلادی (برای سن)
alter table public.profiles add column if not exists activity_level text default 'light';
--  activity_level: sedentary | light | moderate | active | very_active
