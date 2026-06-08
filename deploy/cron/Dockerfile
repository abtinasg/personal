# کانتینرِ سبکِ کرون برای ابرِ آروان — فقط curl می‌زند به مسیرهای /api/cron اپ.
# هیچ دانلودِ خارجی هنگامِ build ندارد (فقط apk از میرورِ آلپاین) تا روی شبکهٔ
# داخل بدونِ مشکل build شود.
FROM alpine:3.20

# curl برای فراخوانی + tzdata تا کرون به وقتِ تهران اجرا شود.
RUN apk add --no-cache curl tzdata \
 && cp /usr/share/zoneinfo/Asia/Tehran /etc/localtime \
 && echo "Asia/Tehran" > /etc/timezone
ENV TZ=Asia/Tehran

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
COPY run-cron.sh   /usr/local/bin/run-cron.sh
COPY crontab       /etc/crontabs/root

RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/run-cron.sh \
 && chmod 600 /etc/crontabs/root

# busybox crond در فورگراند؛ خروجیِ jobها به لاگِ کانتینر می‌رود.
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
