# یک‌درصد 📈

> هر روز یک‌درصد بهتر.

اپ ساده و زیبا (اپل‌استایل، فارسی و راست‌چین) برای ساختنِ هویت و رشدِ مرکب:
**هویت‌ها، ماموریت‌ها، عادت‌های اتمی، کالری‌شمار، بودجه و خرج، سلامتی، تمرین و یک مربیِ هوشمند**.

- فریم‌ورک: **Next.js 15** (App Router) + TypeScript + Tailwind
- دیتابیس: **Supabase** (Postgres)
- ورود: **Passkey** (بدون رمز — Face ID / Touch ID / پین دستگاه) با `@simplewebauthn`
- آماده‌ی دیپلوی روی **Vercel**

---

## ۱) راه‌اندازی Supabase

1. در [supabase.com](https://supabase.com) یک پروژه‌ی جدید بساز.
2. وارد **SQL Editor** شو، فایل [`supabase/schema.sql`](supabase/schema.sql) را کپی و **Run** کن.
3. از **Project Settings → API** این دو مقدار را بردار:
   - `Project URL` → برای `NEXT_PUBLIC_SUPABASE_URL`
   - `service_role` key (بخش *Project API keys*) → برای `SUPABASE_SERVICE_ROLE_KEY`

> ⚠️ کلید `service_role` فقط سمت سرور استفاده می‌شود و هرگز نباید در کلاینت یا گیت قرار بگیرد.

## ۲) متغیرهای محیطی

فایل `.env.local.example` را به `.env.local` کپی کن و مقادیر را پر کن:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SESSION_SECRET=یک-رشته-تصادفی-طولانی
NEXT_PUBLIC_APP_NAME=یک‌درصد
```

برای ساخت `SESSION_SECRET`:

```bash
openssl rand -base64 48
```

## ۳) اجرا روی سیستم

```bash
pnpm install     # یا: npm install
pnpm dev         # http://localhost:3000
```

روی `localhost` پسکی روی همان مرورگر کار می‌کند (Chrome/Safari جدید).

## ۴) دیپلوی روی Vercel

1. پروژه را روی GitHub بگذار و در [vercel.com](https://vercel.com) ایمپورت کن.
2. در **Settings → Environment Variables** همان چهار متغیر بالا را اضافه کن.
3. Deploy.

پسکی به‌صورت خودکار با دامنه‌ی Vercel (مثل `your-app.vercel.app`) کار می‌کند، چون
`rpID` و `origin` از روی هدر درخواست تشخیص داده می‌شوند. اگر دامنه‌ی اختصاصی اضافه کردی،
پسکی‌هایی که قبلاً روی دامنه‌ی قدیمی ساخته شده‌اند روی دامنه‌ی جدید کار نمی‌کنند (محدودیت امنیتی WebAuthn).

---

## ساختار

```
src/
  app/
    api/auth/*        ← ثبت‌نام/ورود/خروج با پسکی + me
    api/{meals,transactions,health,habits,moods,profile}  ← CRUD داده‌ها
    login/page.tsx    ← صفحه‌ی ورود/ثبت‌نام
    page.tsx          ← گیت احراز هویت + پوسته‌ی اپ
  components/
    AppShell.tsx      ← هدر، تب‌بار، تنظیمات
    views/*           ← داشبورد، کالری، بودجه، سلامتی، عادت‌ها
    ui.tsx, icons.tsx ← اجزای اپل‌استایل (کارت، حلقه، شیت...)
  lib/
    auth.ts, webauthn.ts, supabase.ts, api.ts, format.ts, types.ts
supabase/schema.sql   ← اسکیمای دیتابیس
```

## نکات

- همه‌ی داده‌ها سمت سرور با کلید `service_role` و **محدود به کاربرِ نشست** خوانده/نوشته می‌شوند.
  RLS روی همه‌ی جدول‌ها فعال است تا کلید anon هیچ دسترسی‌ای نداشته باشد.
- نشست با کوکی `httpOnly` و JWT امضاشده (`jose`) نگه‌داری می‌شود (۳۰ روز).
- تاریخ‌ها به‌صورت شمسی (تقویم فارسی) نمایش داده می‌شوند.
