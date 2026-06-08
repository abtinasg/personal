# زمان‌بندیِ Cron روی ArvanCloud Container Service

ما **از Vercel استفاده نمی‌کنیم** — اپ روی **سرویسِ Container** ابرِ ابر آروان دیپلوی می‌شود.
این یعنی `vercel.json` (که قبلاً کرون‌ها را تعریف می‌کرد) کاربردی ندارد و حذف شده.
به‌جایش یکی از این دو روش را برای زمان‌بندیِ کرون‌ها استفاده می‌کنیم:

## مسیرهای کرون

| Path | بازه‌ی پیشنهادی | شرح |
| --- | --- | --- |
| `/api/cron/notify` | روزانه `30 4 * * *` | یادآوریِ روزانه‌ی جوانه |
| `/api/cron/reconcile` | هر ۱۵ دقیقه `*/15 * * * *` | تطبیقِ پرداختِ زیبال |
| `/api/cron/cost-guard` | هر ۱۰ دقیقه `*/10 * * * *` | پایشِ بودجه‌ی AI و قطع خودکار |

هر سه با هدرِ `Authorization: Bearer $CRON_SECRET` احراز می‌شوند.

> 🛡️ **شبکه‌ی ایمنی:** حتی اگر هیچ کرونی وصل نباشد، سقفِ سختِ `AI_GLOBAL_DAILY_CAP`
> (داخلِ `aiGuard`) و فلگِ `ai_enabled` همچنان جلوی هزینه‌ی بی‌حساب را می‌گیرند.
> کرون‌ها برای **خودکارسازی** لازم‌اند (تطبیقِ پرداخت، یادآوری، قطعِ هوشمندِ بودجه)،
> نه به‌عنوان تنها خطِ دفاع. پس می‌توانی با خیال راحت اول اپ را بالا بیاوری و بعد کرون را وصل کنی.

## روش ۰ — کانتینرِ جانبیِ کرون (`deploy/cron`) — توصیه‌شده ✅

مطمئن‌ترین راه که به امکاناتِ پنل وابسته نیست: یک کانتینرِ بسیار سبک (آلپاین + curl)
که فقط مسیرهای بالا را با هدرِ امن صدا می‌زند. فایل‌هایش آماده‌ی build است:

```
deploy/cron/
  ├── Dockerfile      # alpine + busybox crond (بدونِ دانلودِ خارجی هنگامِ build)
  ├── crontab         # زمان‌بندی به وقتِ تهران
  ├── entrypoint.sh   # env را امن به crond می‌دهد
  └── run-cron.sh     # curl + لاگ
```

**دیپلوی روی آروان:**
1. پنلِ آروان → یک **اپلیکیشن/سرویسِ جدید** بساز با **Build context = `deploy/cron`**
   (یا image را جدا build و به رجیستریِ آروان push کن).
2. این دو متغیرِ محیطی را به سرویسِ کرون بده:
   - `APP_URL` = آدرسِ کاملِ اپ، مثلاً `https://yourdomain.ir`
   - `CRON_SECRET` = **دقیقاً همان** مقداری که در سرویسِ اصلیِ اپ است.
3. منابع را حداقل بگذار (۶۴–۱۲۸MB رم کافی است) و ۱ replica، همیشه روشن.

زمان‌بندیِ پیش‌فرض (در `deploy/cron/crontab`، به وقتِ تهران چون `TZ=Asia/Tehran`):
notify ساعتِ ۸ صبح، reconcile هر ۱۵ دقیقه، cost-guard هر ۱۰ دقیقه. لاگِ هر اجرا در
لاگِ کانتینر دیده می‌شود (`[cron] reconcile ok ...`).

> build و تستِ محلی:
> ```sh
> cd deploy/cron
> docker build -t cron-sidecar .
> docker run --rm -e APP_URL=https://yourdomain.ir -e CRON_SECRET=xxxx cron-sidecar
> ```

## روش ۱ — Scheduled Job در پنلِ آروان (اگر در دسترس بود)

اگر سرویسِ Container آروان امکانِ **Scheduled Job** دارد:

1. پنل آروان → پروژه → Scheduled Jobs → New Job
2. Image را همان image اپ بگذار (یا یک تصویرِ سبکِ `curlimages/curl`)
3. دستور:
   ```sh
   curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
        https://<your-domain>/api/cron/reconcile
   ```
4. زمان‌بندی را با cron-expression تنظیم کن (همان جدولِ بالا)
5. متغیرِ `CRON_SECRET` را به‌صورت secret به job وصل کن

برای هر سه مسیر یک job جدا بساز.

## روش ۲ — Cron از یک سرورِ بیرونی (Cron-job.org / EasyCron / VPS)

اگر Scheduled Job در پنل نبود، از یک سرویسِ کرونِ بیرونی استفاده کن
(مثلاً [cron-job.org](https://cron-job.org) رایگان):

- URL: `https://<your-domain>/api/cron/reconcile?secret=<CRON_SECRET>`
- Method: GET
- زمان‌بندی: همان جدول بالا

> توجه: گذاشتنِ secret در query آسان‌تر است ولی در لاگ‌های HTTP می‌ماند. روشِ
> هدرِ Authorization امن‌تر است؛ هر سرویس کرونی که هدرِ سفارشی پشتیبانی کند را
> ترجیح بده.

## متغیرهای محیطی روی Container

### الزامی (سرویسِ اصلیِ اپ)
```
DATABASE_URL=postgres://...        # Arvan DBaaS — بدون sslmode=require (پیش‌فرض: بدون SSL)
SESSION_SECRET=...                 # کلیدِ JWT سشن (openssl rand -base64 48)
CRON_SECRET=...                    # احراز هویتِ کرون‌ها — در سرویسِ کرون هم همین مقدار
NEXT_PUBLIC_BASE_URL=https://<your-domain>
NEXT_PUBLIC_APP_NAME=یک‌درصد

# پیامک (sms.ir)
SMSIR_API_KEY=...
SMSIR_LINE=...
SMSIR_TEMPLATE_ID=...
SMSIR_TEMPLATE_PARAM=...           # نامِ پارامترِ کد در قالب (مثلاً CODE)

# پرداخت (زیبال)
ZIBAL_MERCHANT_ID=...
ZIBAL_SANDBOX=0                    # برای پروداکشن حتماً 0 (یا حذف)

# هوش مصنوعی (OpenRouter)
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=...

# نوتیفیکیشنِ وب (VAPID)
VAPID_PUBLIC_KEY=...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...   # همان publicِ بالا، برای کلاینت
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:you@yourdomain.ir

# مدیر
ADMIN_USERNAME=...
ADMIN_PASSWORD=...
```

### اختیاری (کلیدهای کنترلِ هزینه/سوءاستفاده — همگی پیش‌فرضِ امن دارند)
```
AI_GLOBAL_DAILY_CAP=5000           # سقفِ سختِ کلِ فراخوانیِ AI در روز (۰ = خاموش)
GUEST_PER_HOUR=5                   # حداکثر ساختِ کاربرِ مهمان از هر IP در ساعت
GUEST_PER_DAY=20                   # حداکثر در روز
OTP_OPEN_HOUR=8                    # شروعِ بازه‌ی ارسالِ پیامک (وقتِ تهران)
OTP_CLOSE_HOUR=22                  # پایانِ بازه — با خطِ خدماتی: 0 و 24 بگذار
```

> ⚠️ `TEST_PHONE` / `TEST_OTP_CODE` فقط برای توسعه‌اند و حالا در `NODE_ENV=production`
> کاملاً بی‌اثرند (درِ پشتیِ کدِ ثابت بسته شد). در پروداکشن اصلاً ستشان نکن.

### سرویسِ کرون (`deploy/cron`)
فقط همین دو:
```
APP_URL=https://<your-domain>
CRON_SECRET=...                    # دقیقاً همان CRON_SECRETِ اپ
```

## مانیتورینگ

برای هلث‌چک، `/api/healthz` را به یک سرویسِ uptime (مثل UptimeRobot) وصل کن —
بدون احراز هویت است و `200` بازمی‌گرداند اگر دیتابیس بالا باشد، در غیرِ این صورت `503`.
