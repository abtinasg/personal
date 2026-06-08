import { adminAuthed, ok, bad } from "@/lib/api";
import { aiEstCostUsd, aiGlobalDailyCap, computeMrr, usdToToman } from "@/lib/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * داده‌ی همه‌ی داشبوردهای مدیریت در یک فراخوانی (اتاقِ جنگ، درآمد، هوش مصنوعی،
 * عملیات، قیف). در مقیاسِ ۱۰۰ کاربر این یک round-trip کافی است و کلاینت ساده می‌ماند.
 *
 * همه‌ی بازه‌های «امروز» به وقتِ تهران حساب می‌شوند (همان منطقِ پنجره‌ی OTP)، تا
 * مرزِ روز با کاربرِ ایرانی یکی باشد و نه UTC.
 */

// شروعِ امروز به وقتِ تهران، برای مقایسه با timestampِ تبدیل‌شده به تهران.
const DAY = `date_trunc('day', now() at time zone 'Asia/Tehran')`;
const local = (col: string) => `(${col} at time zone 'Asia/Tehran')`;

type Row = Record<string, unknown>;
const num = (v: unknown): number => Number(v ?? 0) || 0;

export async function GET() {
  const a = await adminAuthed();
  if ("error" in a) return a.error;
  const db = a.db;
  const started = Date.now();

  try {
    const [
      active,
      users,
      activation,
      d1,
      d7,
      subs,
      revenue,
      revByDay,
      payStatus,
      revByPlan,
      stuck,
      activations,
      aiByEndpointToday,
      aiTotals,
      aiTopUsers,
      otp,
      guestToday,
      guestByIp,
      push,
      eventsToday,
      events7d,
    ] = await Promise.all([
      // فعالیت: کاربرانِ زنده (۱۵ دقیقه) + DAU/WAU/MAU
      db.query<Row>(`
        select
          count(distinct user_id) filter (where created_at >= now() - interval '15 minutes') as live15,
          count(distinct user_id) filter (where ${local("created_at")} >= ${DAY}) as dau,
          count(distinct user_id) filter (where created_at >= now() - interval '7 days') as wau,
          count(distinct user_id) filter (where created_at >= now() - interval '30 days') as mau
        from public.v_activity`),

      // کاربران: کل، مهمان، ثبت‌نامِ امروز/۷روز
      db.query<Row>(`
        select
          count(*) filter (where not is_guest) as total_users,
          count(*) filter (where is_guest) as total_guests,
          count(*) filter (where not is_guest and ${local("created_at")} >= ${DAY}) as signups_today,
          count(*) filter (where not is_guest and created_at >= now() - interval '7 days') as signups_7d
        from public.users`),

      // نرخِ فعال‌سازی: کوهورتِ ۱۴ روزِ اخیر که ظرفِ ۲۴ ساعت اولین فعالیت را داشتند
      db.query<Row>(`
        with cohort as (
          select id, created_at from public.users
          where is_guest = false and created_at >= now() - interval '14 days'
        )
        select
          count(*) as signups,
          count(*) filter (where exists (
            select 1 from public.v_activity v
            where v.user_id = cohort.id
              and v.created_at >= cohort.created_at
              and v.created_at <= cohort.created_at + interval '24 hours'
          )) as activated
        from cohort`),

      // ماندگاریِ روزِ ۱
      db.query<Row>(`
        with c as (
          select id, created_at from public.users
          where is_guest = false
            and created_at < now() - interval '1 day'
            and created_at >= now() - interval '30 days'
        )
        select count(*) as total,
          count(*) filter (where exists (
            select 1 from public.v_activity v where v.user_id = c.id
              and v.created_at >= c.created_at + interval '1 day'
              and v.created_at <  c.created_at + interval '2 day'
          )) as ret
        from c`),

      // ماندگاریِ روزِ ۷
      db.query<Row>(`
        with c as (
          select id, created_at from public.users
          where is_guest = false
            and created_at < now() - interval '7 day'
            and created_at >= now() - interval '37 days'
        )
        select count(*) as total,
          count(*) filter (where exists (
            select 1 from public.v_activity v where v.user_id = c.id
              and v.created_at >= c.created_at + interval '7 day'
              and v.created_at <  c.created_at + interval '8 day'
          )) as ret
        from c`),

      // اشتراک‌های فعال به تفکیکِ پلن/دوره (مبنای MRR و paying users)
      db.query<Row>(`
        select plan, cycle, count(*) as n
        from public.subscriptions where expires_at > now()
        group by plan, cycle`),

      // درآمد: امروز + ۷ روز + شمارشِ پرداختِ موفقِ امروز
      db.query<Row>(`
        select
          coalesce(sum(amount) filter (where status='paid' and ${local("paid_at")} >= ${DAY}),0) as rev_today,
          count(*) filter (where status='paid' and ${local("paid_at")} >= ${DAY}) as paid_today,
          coalesce(sum(amount) filter (where status='paid' and paid_at >= now() - interval '7 days'),0) as rev_7d
        from public.payments`),

      // درآمد روزانه (۱۴ روز)
      db.query<Row>(`
        select to_char(${local("paid_at")}::date,'YYYY-MM-DD') as d,
               coalesce(sum(amount),0) as total, count(*) as n
        from public.payments
        where status='paid' and paid_at >= now() - interval '14 days'
        group by 1 order by 1`),

      // وضعیتِ پرداخت‌ها (۳۰ روز)
      db.query<Row>(`
        select status, count(*) as n, coalesce(sum(amount),0) as total
        from public.payments where created_at >= now() - interval '30 days'
        group by status`),

      // درآمد به تفکیکِ پلن (۳۰ روز، فقط موفق)
      db.query<Row>(`
        select coalesce(plan,'credits') as plan, count(*) as n, coalesce(sum(amount),0) as total
        from public.payments
        where status='paid' and paid_at >= now() - interval '30 days'
        group by 1`),

      // پرداخت‌های گیرکرده (پول کسر شده، اشتراک فعال نشده؟) — خطرِ شماره‌یک درآمد
      db.query<Row>(`
        select p.id, p.amount, p.plan, p.cycle, p.created_at, u.username, u.display_name
        from public.payments p left join public.users u on u.id = p.user_id
        where p.status='pending'
          and p.created_at < now() - interval '30 minutes'
          and p.created_at >= now() - interval '24 hours'
        order by p.created_at desc limit 50`),

      // فعال‌سازی/تمدیدِ اشتراکِ امروز (نو در برابر تمدید)
      db.query<Row>(`
        with paid_today as (
          select id, user_id, paid_at from public.payments
          where status='paid' and plan is not null and ${local("paid_at")} >= ${DAY}
        )
        select
          count(*) as total,
          count(*) filter (where exists (
            select 1 from public.payments e
            where e.user_id = paid_today.user_id and e.status='paid'
              and e.plan is not null and e.paid_at < paid_today.paid_at
          )) as renewals
        from paid_today`),

      // فراخوانیِ هوش مصنوعی امروز به تفکیکِ اندپوینت
      db.query<Row>(`
        select endpoint, count(*) as n from public.ai_usage
        where ${local("created_at")} >= ${DAY}
        group by endpoint order by n desc`),

      // مجموعِ فراخوانیِ AI امروز/۷روز
      db.query<Row>(`
        select
          count(*) filter (where ${local("created_at")} >= ${DAY}) as calls_today,
          count(*) filter (where created_at >= now() - interval '7 days') as calls_7d,
          count(distinct user_id) filter (where ${local("created_at")} >= ${DAY}) as users_today
        from public.ai_usage`),

      // پرمصرف‌ترین کاربرانِ AI امروز (تشخیصِ سوءاستفاده)
      db.query<Row>(`
        select a.user_id, count(*) as n, u.username, u.display_name, u.is_guest
        from public.ai_usage a left join public.users u on u.id = a.user_id
        where ${local("a.created_at")} >= ${DAY}
        group by a.user_id, u.username, u.display_name, u.is_guest
        order by n desc limit 10`),

      // OTP: تعدادِ شماره‌هایی که امروز کد گرفتند
      db.query<Row>(`
        select count(*) as n from public.phone_otps where ${local("last_sent_at")} >= ${DAY}`),

      // مهمانِ ساخته‌شده امروز
      db.query<Row>(`
        select count(*) as n from public.guest_signups where ${local("created_at")} >= ${DAY}`),

      // IPهای پرتکرارِ ساختِ مهمان (۲۴ ساعت) — سیگنالِ سوءاستفاده
      db.query<Row>(`
        select ip, count(*) as n from public.guest_signups
        where created_at >= now() - interval '24 hours'
        group by ip order by n desc limit 8`),

      // مشترکینِ پوش
      db.query<Row>(`select count(*) as n from public.push_subscriptions`),

      // رویدادهای امروز (قیف + خطاها) — اگر جدول هنوز خالی است صفر می‌شود
      db.query<Row>(`
        select name, count(*) as n from public.events
        where ${local("created_at")} >= ${DAY} group by name`).catch(() => [] as Row[]),

      // رویدادهای ۷ روز (نرخِ تبدیلِ قیف)
      db.query<Row>(`
        select name, count(*) as n from public.events
        where created_at >= now() - interval '7 days' group by name`).catch(() => [] as Row[]),
    ]);

    // ── مشتق‌سازیِ مقادیر در TS ──────────────────────────────────────────────
    const subRows = subs.map((s) => ({ plan: String(s.plan), cycle: String(s.cycle), n: num(s.n) }));
    const payingUsers = subRows.reduce((s, r) => s + r.n, 0);
    const mrr = computeMrr(subRows);

    const endpointCounts = aiByEndpointToday.map((r) => ({ endpoint: String(r.endpoint), n: num(r.n) }));
    const aiCostUsdToday = aiEstCostUsd(endpointCounts);
    const aiCostTomanToday = Math.round(aiCostUsdToday * usdToToman());
    const callsToday = num(aiTotals[0]?.calls_today);
    const cap = aiGlobalDailyCap();

    const revToday = num(revenue[0]?.rev_today);
    const profitToday = revToday - aiCostTomanToday;

    const eventMap = (rows: Row[]): Record<string, number> =>
      Object.fromEntries(rows.map((r) => [String(r.name), num(r.n)]));
    const ev7 = eventMap(events7d);
    const evToday = eventMap(eventsToday);

    const actSignups = num(activation[0]?.signups);
    const actActivated = num(activation[0]?.activated);
    const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

    return ok({
      generatedAt: new Date().toISOString(),
      queryMs: Date.now() - started,

      // اتاقِ جنگ — برداشتِ ۶۰ ثانیه‌ایِ سلامتِ پرتاب
      overview: {
        live: num(active[0]?.live15),
        signupsToday: num(users[0]?.signups_today),
        paidToday: num(revenue[0]?.paid_today),
        revToday,
        aiCallsToday: callsToday,
        aiCostTomanToday,
        aiCapPct: cap > 0 ? Math.round((callsToday / cap) * 100) : 0,
        errorsToday: (evToday["ai_error"] ?? 0),
        stuckPayments: stuck.length,
        activeSubs: payingUsers,
        dbLatencyMs: Date.now() - started,
      },

      // داشبوردِ بنیان‌گذار — KPIهای کلیدی
      founder: {
        dau: num(active[0]?.dau),
        wau: num(active[0]?.wau),
        mau: num(active[0]?.mau),
        signupsToday: num(users[0]?.signups_today),
        signups7d: num(users[0]?.signups_7d),
        totalUsers: num(users[0]?.total_users),
        totalGuests: num(users[0]?.total_guests),
        activationPct: pct(actActivated, actSignups),
        d1Pct: pct(num(d1[0]?.ret), num(d1[0]?.total)),
        d7Pct: pct(num(d7[0]?.ret), num(d7[0]?.total)),
        payingUsers,
        mrr,
        revToday,
        aiCostTomanToday,
        profitToday,
      },

      // درآمد
      revenue: {
        revToday,
        rev7d: num(revenue[0]?.rev_7d),
        paidToday: num(revenue[0]?.paid_today),
        byDay: revByDay.map((r) => ({ d: String(r.d), total: num(r.total), n: num(r.n) })),
        status: payStatus.map((r) => ({ status: String(r.status), n: num(r.n), total: num(r.total) })),
        byPlan: revByPlan.map((r) => ({ plan: String(r.plan), n: num(r.n), total: num(r.total) })),
        stuck: stuck.map((r) => ({
          id: String(r.id),
          amount: num(r.amount),
          plan: r.plan ? String(r.plan) : null,
          cycle: r.cycle ? String(r.cycle) : null,
          createdAt: String(r.created_at),
          user: (r.display_name as string) || (r.username as string) || "—",
        })),
        activationsToday: num(activations[0]?.total),
        renewalsToday: num(activations[0]?.renewals),
      },

      // هوش مصنوعی
      ai: {
        callsToday,
        calls7d: num(aiTotals[0]?.calls_7d),
        usersToday: num(aiTotals[0]?.users_today),
        cap,
        capPct: cap > 0 ? Math.round((callsToday / cap) * 100) : 0,
        estCostUsdToday: Math.round(aiCostUsdToday * 10000) / 10000,
        estCostTomanToday: aiCostTomanToday,
        byEndpoint: endpointCounts,
        topUsers: aiTopUsers.map((r) => ({
          n: num(r.n),
          user: (r.display_name as string) || (r.username as string) || "—",
          isGuest: !!r.is_guest,
        })),
        errorsToday: evToday["ai_error"] ?? 0,
      },

      // عملیات
      ops: {
        otpToday: num(otp[0]?.n),
        otpClosedToday: evToday["otp_closed"] ?? 0,
        guestToday: num(guestToday[0]?.n),
        guestByIp: guestByIp.map((r) => ({ ip: String(r.ip), n: num(r.n) })),
        pushSubs: num(push[0]?.n),
        stuckPayments: stuck.length,
      },

      // قیفِ ۷ روز (مهمان → ثبت‌نام → شروعِ پرداخت → پرداخت)
      funnel: {
        guestStart: ev7["guest_start"] ?? 0,
        signup: ev7["signup"] ?? 0,
        checkoutStart: ev7["checkout_start"] ?? 0,
        paymentPaid: ev7["payment_paid"] ?? 0,
      },
    });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "خطا در محاسبه‌ی آمار.", 500);
  }
}
