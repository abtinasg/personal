#!/bin/sh
# یک مسیرِ کرون را با هدرِ Authorization صدا می‌زند و نتیجه را در لاگ می‌نویسد.
# استفاده: run-cron.sh <path>     (مثلاً: run-cron.sh reconcile)
set -u
. /etc/cron-env.sh

path="$1"
ts="$(date -Iseconds)"
if curl -fsS -m 60 -H "Authorization: Bearer ${CRON_SECRET}" "${APP_URL}/api/cron/${path}" >/dev/null; then
  echo "[cron] ${path} ok ${ts}"
else
  echo "[cron] ${path} FAILED (exit $?) ${ts}"
fi
