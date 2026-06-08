-- ============================================================
--  مهاجرت ۰۱۵ — سیستمِ پشتیبانی (تیکت، گفتگو، FAQ)
--
--  هدف: بنیان‌گذار/تیمِ پشتیبانی بتواند مشکل‌های کاربران را در یک
--  جایِ متمرکز ببیند، اولویت‌بندی کند، و پاسخ بدهد. کاربر هم از داخلِ
--  اپ می‌تواند تیکت بسازد و سابقه‌ی گفتگو را ببیند.
--
--  سه جدول:
--   ۱) support_tickets — هر تیکت با دسته/اولویت/وضعیت/متادیتا
--   ۲) support_messages — گفت‌وگوی پیامی (کاربر ↔ کارمند) ذیلِ هر تیکت
--   ۳) support_faqs — پایگاهِ FAQِ خودسرویس که هم در اپ و هم در پنل ادمین
--      دیده/ویرایش می‌شود
--
--  افزایشی و idempotent. روی Arvan/Postgres اجرا کن.
-- ============================================================

-- ---------- تیکت‌ها ----------
create table if not exists public.support_tickets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.users(id) on delete set null,
  -- برای تیکتِ مهمان یا وقتی کاربر شماره/ایمیل برای پیگیری می‌گذارد:
  contact      text,
  -- دسته‌بندی — هم‌راستا با Support Inbox Design:
  --   auth | otp | payment | subscription | ai_quality | bug
  --   notification | data | refund | abuse | feature_request | general
  category     text not null default 'general',
  -- اولویتِ سرویس:
  --   p0 (فوری < ۲س) | p1 (همان روز) | p2 (۲۴س) | p3 (۷۲س)
  priority     text not null default 'p2',
  -- وضعیت:
  --   new (تازه) | open (در حال بررسی) | waiting_user (منتظرِ کاربر)
  --   resolved (حل شد) | closed (بسته)
  status       text not null default 'new',
  subject      text not null,
  body         text not null,
  -- نامِ کاربریِ کارمندی که تیکت به او واگذار شده (NULL = بی‌صاحب)
  assigned_to  text,
  -- متادیتای آزاد: user_agent, url, payment_id, …
  meta         jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  resolved_at  timestamptz
);
create index if not exists support_tickets_status_idx   on public.support_tickets(status, priority, created_at desc);
create index if not exists support_tickets_user_idx     on public.support_tickets(user_id, created_at desc);
create index if not exists support_tickets_category_idx on public.support_tickets(category, created_at desc);
alter table public.support_tickets enable row level security;

-- ---------- پیام‌های یک تیکت ----------
create table if not exists public.support_messages (
  id           uuid primary key default gen_random_uuid(),
  ticket_id    uuid not null references public.support_tickets(id) on delete cascade,
  -- نویسنده: user (خودِ کاربر) | staff (کارمند پشتیبانی) | system (یادداشتِ خودکار)
  author_type  text not null check (author_type in ('user','staff','system')),
  author_name  text,                  -- برای نمایش: نامِ کاربر یا ادمین
  body         text not null,
  -- یادداشتِ داخلی (فقط برای تیمِ پشتیبانی، به کاربر نشان داده نمی‌شود)
  is_internal  boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists support_messages_ticket_idx on public.support_messages(ticket_id, created_at);
alter table public.support_messages enable row level security;

-- ---------- FAQ ----------
create table if not exists public.support_faqs (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  question      text not null,
  short_answer  text not null,
  body          text not null,
  category      text not null default 'general',
  order_index   int  not null default 100,
  published     boolean not null default true,
  updated_at    timestamptz not null default now()
);
create index if not exists support_faqs_published_idx on public.support_faqs(published, category, order_index);
alter table public.support_faqs enable row level security;

-- ---------- یک trigger ساده برای updated_at ----------
create or replace function public.support_touch_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end; $$ language plpgsql;

drop trigger if exists support_tickets_touch on public.support_tickets;
create trigger support_tickets_touch
  before update on public.support_tickets
  for each row execute function public.support_touch_updated_at();

drop trigger if exists support_faqs_touch on public.support_faqs;
create trigger support_faqs_touch
  before update on public.support_faqs
  for each row execute function public.support_touch_updated_at();

-- ---------- وقتی تیکت resolved/closed شد، resolved_at را ست کن ----------
create or replace function public.support_ticket_resolved_at() returns trigger as $$
begin
  if new.status in ('resolved','closed') and old.status not in ('resolved','closed') then
    new.resolved_at := now();
  end if;
  if new.status not in ('resolved','closed') then
    new.resolved_at := null;
  end if;
  return new;
end; $$ language plpgsql;

drop trigger if exists support_tickets_resolved_at on public.support_tickets;
create trigger support_tickets_resolved_at
  before update on public.support_tickets
  for each row execute function public.support_ticket_resolved_at();

-- ---------- داده‌ی اولیه‌ی FAQ (idempotent) ----------
insert into public.support_faqs (slug, question, short_answer, body, category, order_index) values
  ('signup-how',
   'چطور ثبت‌نام کنم؟',
   'شماره موبایلت رو وارد کن، کد تایید رو بزن — تمام.',
   'یک‌درصد رمز عبور نداره. شماره موبایلِ ایرانی وارد کن، یه کد ۶ رقمی برات SMS می‌شه، اون رو وارد کن و وارد اپ می‌شی. اولین ورود، حسابت خودکار ساخته می‌شه.',
   'auth', 10),
  ('otp-not-received',
   'چرا کد تایید به دستم نرسید؟',
   'چند دقیقه صبر کن و دوباره درخواست بده. اگر نرسید با پشتیبانی تماس بگیر.',
   'دلایلِ رایج: سیگنالِ ضعیف، تأخیرِ اپراتور، یا اشتباه‌بودنِ شماره. ابتدا شماره رو دوباره بررسی کن. بعد از ۶۰ ثانیه دوباره درخواست بده. اگر بعد از ۳ بار نرسید، احتمالاً اپراتورت پیامک‌های سیستمی رو بلاک کرده — تیکت بزن.',
   'otp', 10),
  ('otp-expired',
   'کد وارد کردم ولی گفت منقضی شده.',
   'کد ۵ دقیقه اعتبار داره. دوباره درخواست بده.',
   'برای امنیت، کدها بعد از ۵ دقیقه منقضی می‌شن. روی «ارسال مجدد» بزن. اگر دائم منقضی می‌شه، ساعتِ دستگاهت رو با اینترنت sync کن.',
   'otp', 20),
  ('plans-overview',
   'پلن‌های یک‌درصد چی هستن؟',
   'رایگان، پلاس ۸۹٬۰۰۰ت/ماه، پرو ۱۵۹٬۰۰۰ت/ماه.',
   'پلنِ رایگان: ردیابیِ بی‌نهایت + ۵ گفتگو با جوانه در روز. پلاس: گفتگوی نامحدود با جوانه و امکاناتِ هوشمندتر. پرو: تحلیلِ عمیق‌تر و اولویت در پاسخ‌گویی. سالانه = ۲ ماه هدیه.',
   'subscription', 10),
  ('upgrade-how',
   'چطور پلنم رو ارتقا بدم؟',
   'پروفایل ← اشتراک ← انتخاب پلن.',
   'وارد پروفایل → اشتراک شو، پلنِ دلخواه رو بزن، به درگاهِ زیبال منتقل می‌شی. پس از پرداختِ موفق، پلنت بلافاصله فعال می‌شه.',
   'subscription', 20),
  ('payment-success-no-plan',
   'پرداخت کردم ولی پلن فعال نشد.',
   'تیکت بزن، با شماره تراکنش — ظرف ۲ ساعت حل می‌شه.',
   'گاهی به‌خاطر تأخیرِ شبکه، تأییدِ پرداخت دیر می‌رسه. اگر ۳۰ دقیقه گذشته و هنوز فعال نشده، شماره تراکنش (۲۶ رقمی از پیامکِ بانک) رو در تیکت بذار — دستی فعالش می‌کنیم.',
   'payment', 10),
  ('payment-failed',
   'پرداختم ناموفق بود — چرا؟',
   'احتمالاً رمزِ اشتباه، موجودیِ ناکافی، یا VPN فعال.',
   'شایع‌ترین دلایل: ۱) رمزِ دوم اشتباه ۲) موجودیِ کافی نیست ۳) VPN فعاله — خاموشش کن ۴) کارت برای خریدِ اینترنتی فعال نیست.',
   'payment', 20),
  ('refund-policy',
   'سیاستِ استردادِ مبلغ چیه؟',
   'تا ۷۲ ساعت پس از خرید با کمتر از ۲ گفتگو، استردادِ کامل.',
   'اگر ظرفِ ۷۲ ساعت از خرید درخواست بدی و کمتر از ۲ گفتگو با جوانه داشته باشی، مبلغ کامل برمی‌گرده. بعد از آن به‌صورتِ موردی بررسی می‌شه.',
   'refund', 10),
  ('cancel-subscription',
   'چطور اشتراکم رو لغو کنم؟',
   'پروفایل ← اشتراک ← لغو.',
   'بعد از لغو، تا پایانِ دوره‌ی فعلی دسترسی داری. تمدید خودکار نمی‌شه. داده‌هات پاک نمی‌شه.',
   'subscription', 30),
  ('javane-what',
   'جوانه چیه؟',
   'مربیِ هوشمندِ شخصی‌ات — هم‌قدمت در مسیرِ هدف‌ها.',
   'جوانه یه مربی AI فارسی‌زبانه که کمکت می‌کنه هدف‌هات رو تعریف کنی، برنامه بریزی و روزانه پیشرفت کنی. بدونِ سرزنش، فقط همراهی 🌱',
   'ai_quality', 10),
  ('ai-quota',
   'سقفِ ۵ گفتگو در روز چطور کار می‌کنه؟',
   'هر شب نیمه‌شب ریست می‌شه.',
   'در پلنِ رایگان، هر ۲۴ ساعت ۵ پیام به جوانه می‌تونی بدی. برای نامحدود، پلاس یا پرو رو امتحان کن.',
   'ai_quality', 20),
  ('ai-timeout',
   'جوانه پاسخ نداد یا کند بود.',
   'صبر کن ۳۰ ثانیه، دوباره بفرست.',
   'گاهی سرورهای AI شلوغن. اگر ۳ بار تلاش کردی و نشد، اتصالِ اینترنت رو چک کن. اگر مشکل ادامه داشت تیکت بزن.',
   'ai_quality', 30),
  ('pwa-install',
   'یک‌درصد رو چطور نصب کنم؟',
   'PWA هست — از مرورگر «افزودن به صفحه اصلی».',
   'در مرورگرِ موبایل سایت رو باز کن، روی «افزودن به صفحه اصلی» بزن. مثلِ اپ کار می‌کنه. آپدیت‌ها هم خودکار اعمال می‌شن.',
   'general', 10),
  ('app-not-loading',
   'صفحه‌ی سفید / اپ لود نمی‌شه.',
   'مرورگر رو ببند و دوباره باز کن، یا cache رو پاک کن.',
   '۱) مرورگر رو کاملاً ببند و باز کن. ۲) اگر نشد، تنظیماتِ مرورگر → پاک‌کردنِ داده‌های سایت. ۳) اگر هنوز نشد، با اطلاعاتِ دستگاه و مرورگرت تیکت بزن.',
   'bug', 10),
  ('notif-not-received',
   'چرا نوتیفیکیشن نمی‌رسه؟',
   'احتمالاً اجازه‌ی نوتیفیکیشن نداده‌ای.',
   'تنظیماتِ مرورگر → این سایت → نوتیفیکیشن → مجاز. روی iOS باید اپ رو به صفحه اصلی اضافه کرده باشی.',
   'notification', 10),
  ('data-deleted',
   'سابقه‌ام حذف شد!',
   'فوری تیکت بزن — معمولاً قابلِ بازیابیه.',
   'داده‌ها soft-delete می‌شن. تاریخِ تقریبی و نوعِ داده رو در تیکت بنویس تا بررسی و بازیابی کنیم.',
   'data', 10),
  ('privacy',
   'مکالماتم با کسی به‌اشتراک گذاشته می‌شه؟',
   'خیر. مکالمات کاملاً خصوصی‌ان.',
   'مکالمات رمزنگاری شده و فقط به‌صورتِ ناشناس برای بهبودِ خدمات استفاده می‌شه. هیچ اطلاعاتِ شخصی به شخصِ سوم فروخته نمی‌شه.',
   'general', 50)
on conflict (slug) do nothing;
