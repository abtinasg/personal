#!/bin/sh
set -eu

# busybox crond محیطِ کانتینر را به jobها منتقل نمی‌کند، پس دو متغیرِ موردِنیاز را
# با کوتیشنِ امن در یک فایل می‌نویسیم تا run-cron.sh آن را source کند.
: "${APP_URL:?APP_URL تنظیم نشده (مثلاً https://yourdomain.ir)}"
: "${CRON_SECRET:?CRON_SECRET تنظیم نشده — باید با CRON_SECRETِ اپ یکی باشد}"

quote() { printf '%s' "$1" | sed "s/'/'\\\\''/g; s/^/'/; s/\$/'/"; }
{
  printf 'export APP_URL=%s\n' "$(quote "$APP_URL")"
  printf 'export CRON_SECRET=%s\n' "$(quote "$CRON_SECRET")"
} > /etc/cron-env.sh

echo "[cron] starting; APP_URL=$APP_URL TZ=$TZ"
exec crond -f -l 8
