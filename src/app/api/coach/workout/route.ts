import { authed, ok, bad } from "@/lib/api";
import { guardAI } from "@/lib/aiGuard";
import { aiJSON } from "@/lib/openrouter";
import { getServiceClient } from "@/lib/supabase";
import { todayISO, daysAgoISO } from "@/lib/format";

export const runtime = "nodejs";

const GOAL_FA: Record<string, string> = {
  lose_fat: "کاهش چربی و تناسب اندام",
  build_muscle: "عضله‌سازی (هایپرتروفی)",
  strength: "افزایش قدرت",
  endurance: "استقامت و آمادگی هوازی",
  general: "سلامت و آمادگی عمومی",
};
const LEVEL_FA: Record<string, string> = {
  beginner: "مبتدی",
  intermediate: "متوسط",
  advanced: "پیشرفته",
};
const LOCATION_FA: Record<string, string> = {
  gym: "باشگاه (دستگاه و دمبل و هالتر)",
  home: "خانه",
  outdoor: "فضای باز",
};

type AIExercise = { name?: string; sets?: number; reps?: string; rest?: string; note?: string };
type AIBlock = { title?: string; kind?: string; duration_min?: number; exercises?: AIExercise[] };
type AIPlan = {
  focus?: string;
  headline?: string;
  summary?: string;
  intensity?: string;
  total_minutes?: number;
  blocks?: AIBlock[];
  coach_notes?: string[];
};

const VALID_KINDS = new Set(["warmup", "strength", "aerobic", "cooldown"]);
const s = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

function sanitize(raw: AIPlan, planOn: string) {
  const blocks = (Array.isArray(raw.blocks) ? raw.blocks : [])
    .map((b) => {
      const kind = VALID_KINDS.has(String(b.kind)) ? (b.kind as string) : "strength";
      const exercises = (Array.isArray(b.exercises) ? b.exercises : [])
        .map((e) => ({
          name: s(e.name, 90),
          sets: Math.min(8, Math.max(1, Math.round(Number(e.sets) || 1))),
          reps: s(e.reps, 40) || "—",
          rest: s(e.rest, 40) || "—",
          ...(e.note ? { note: s(e.note, 140) } : {}),
        }))
        .filter((e) => e.name)
        .slice(0, 10);
      return {
        title: s(b.title, 70) || "بلوک تمرین",
        kind,
        duration_min: Math.min(120, Math.max(0, Math.round(Number(b.duration_min) || 0))),
        exercises,
      };
    })
    .filter((b) => b.exercises.length > 0)
    .slice(0, 6);

  const summed = blocks.reduce((n, b) => n + b.duration_min, 0);
  const total = Math.min(180, Math.max(10, Math.round(Number(raw.total_minutes) || summed || 45)));

  return {
    plan_on: planOn,
    focus: s(raw.focus, 80) || "تمرین امروز",
    headline: s(raw.headline, 120),
    summary: s(raw.summary, 500),
    intensity: s(raw.intensity, 20) || "متوسط",
    total_minutes: total,
    blocks,
    coach_notes: (Array.isArray(raw.coach_notes) ? raw.coach_notes : [])
      .map((t) => s(t, 160))
      .filter(Boolean)
      .slice(0, 5),
    completed: false,
  };
}

function requiredNeeds(p: Record<string, unknown> | null): string[] {
  const needs: string[] = [];
  if (!p?.fitness_goal) needs.push("fitness_goal");
  if (!p?.fitness_level) needs.push("fitness_level");
  if (!p?.workout_location) needs.push("workout_location");
  if (!p?.workout_minutes) needs.push("workout_minutes");
  if (!p?.workout_days) needs.push("workout_days");
  return needs;
}

function rowToPlan(row: { plan: AIPlan & { completed?: boolean }; plan_on: string; completed: boolean }) {
  return { ...row.plan, plan_on: row.plan_on, completed: row.completed };
}

// ── پردازشگرِ پس‌زمینه ────────────────────────────────────────────────────────
// این تابع بعد از برگرداندنِ HTTP response اجرا می‌شود.
// چون کانتینر standalone است (نه serverless)، Node.js پردازش را زنده نگه می‌دارد.
async function generateWorkoutAsync(uid: string, jobId: string, today: string) {
  const db = getServiceClient();
  const thisYear = new Date().getFullYear();

  try {
    const [{ data: profile }, weightRes, missionRes, recentRes] = await Promise.all([
      db.from("profiles").select("*").eq("user_id", uid).maybeSingle(),
      db.from("health_metrics").select("value").eq("user_id", uid).eq("kind", "weight").order("recorded_on", { ascending: false }).limit(1),
      db.from("missions").select("title, target_label, target_value, target_unit").eq("user_id", uid).eq("status", "active").order("created_at", { ascending: false }).limit(1),
      db.from("workout_plans").select("focus, plan_on").eq("user_id", uid).gte("plan_on", daysAgoISO(6)).lt("plan_on", today).order("plan_on", { ascending: false }),
    ]);

    const goal = String(profile!.fitness_goal);
    const level = String(profile!.fitness_level);
    const location = String(profile!.workout_location);
    const minutes = Number(profile!.workout_minutes) || 45;
    const days = Number(profile!.workout_days) || 3;
    const equipment = profile!.workout_equipment ? String(profile!.workout_equipment) : null;
    const limits = profile!.workout_limits ? String(profile!.workout_limits) : null;

    const latestWeight = weightRes.data?.[0]?.value != null ? Number(weightRes.data[0].value) : null;
    const age = profile!.birth_year ? Math.max(10, thisYear - Number(profile!.birth_year)) : null;
    const sex = profile!.sex === "male" ? "مرد" : profile!.sex === "female" ? "زن" : null;
    const mission = missionRes.data?.[0] || null;

    const recentFoci = (recentRes.data || [])
      .map((r) => `${r.plan_on}: ${r.focus || "—"}`)
      .join("؛ ") || "سابقه‌ای از روزهای اخیر ثبت نشده";

    const todayWeekday = new Intl.DateTimeFormat("fa-IR", { weekday: "long" }).format(new Date());

    const raw = await aiJSON<AIPlan>(
      [
        {
          role: "system",
          content:
            "تو یک مربیِ نخبه‌ی قدرت و آمادگی جسمانی (در سطح گواهی‌نامه‌های NSCA-CSCS و ACSM) و فارسی‌زبان هستی. " +
            "وظیفه‌ات طراحیِ «برنامه‌ی تمرینیِ امروز» (فقط همین یک جلسه) به‌صورت کاملاً شخصی‌سازی‌شده، علمی، امن و عملی است. " +
            "اصول حرفه‌ای را رعایت کن: " +
            "۱) هر جلسه باید شاملِ گرم‌کردنِ هدفمند (warmup)، بخشِ اصلیِ قدرتی (strength)، یک بخشِ هوازی/کاندیشنینگ (aerobic) و سردکردن/کشش (cooldown) باشد. " +
            "۲) تعادلِ هوازی و قدرتی را با هدف هماهنگ کن. " +
            "۳) ریکاوری را رعایت کن: با توجه به «تمرکزِ روزهای اخیر»، همان گروه‌های عضلانی را که تازه سنگین کار شده‌اند دوباره سنگین نکن. " +
            "۴) ست/تکرار/استراحت را علمی بده. " +
            "۵) مجموعِ زمانِ بلوک‌ها باید تقریباً برابرِ زمانِ دلخواهِ کاربر باشد. " +
            "۶) حرکات را با تجهیزات و محلِ تمرینِ کاربر بساز. " +
            "۷) محدودیت/آسیبِ کاربر را جدی بگیر. " +
            "۸) اسمِ حرکت‌ها فارسیِ رایجِ باشگاهی باشد. در note برای هر حرکت یک نکته‌ی فرم/تکنیکِ کوتاه بده. " +
            "۹) لحن در headline انگیزشی و کوتاه. coach_notes شاملِ ۲ تا ۴ نکته‌ی طلاییِ مربی. " +
            "فقط و فقط یک JSON معتبر برگردان، بدونِ هیچ متنِ اضافه، با این ساختار: " +
            '{"focus":string,"headline":string,"summary":string,"intensity":"سبک"|"متوسط"|"سنگین","total_minutes":number,' +
            '"blocks":[{"title":string,"kind":"warmup"|"strength"|"aerobic"|"cooldown","duration_min":number,' +
            '"exercises":[{"name":string,"sets":number,"reps":string,"rest":string,"note":string}]}],' +
            '"coach_notes":[string]}',
        },
        {
          role: "user",
          content:
            `امروز: ${todayWeekday}\n` +
            `هدف: ${GOAL_FA[goal] || goal}\n` +
            `سطح: ${LEVEL_FA[level] || level}\n` +
            `محلِ تمرین: ${LOCATION_FA[location] || location}\n` +
            `تجهیزاتِ در دسترس: ${equipment || (location === "gym" ? "تجهیزاتِ کاملِ باشگاه" : "نامشخص — فرض را بر کم‌ترین تجهیزات بگذار")}\n` +
            `زمانِ دلخواهِ هر جلسه: حدود ${minutes} دقیقه\n` +
            `تعدادِ جلسه در هفته: ${days}\n` +
            (limits ? `محدودیت/آسیب: ${limits}\n` : "محدودیت یا آسیبِ خاصی اعلام نشده.\n") +
            (sex ? `جنسیت: ${sex}\n` : "") +
            (age ? `سن: ${age} سال\n` : "") +
            (latestWeight ? `وزن: ${latestWeight} کیلوگرم\n` : "") +
            (mission
              ? `ماموریتِ فعالِ کاربر: «${mission.title}»` +
                (mission.target_label ? ` — هدف: ${mission.target_label} ${mission.target_value ?? ""} ${mission.target_unit ?? ""}` : "") +
                "\n"
              : "") +
            `تمرکزِ روزهای اخیر: ${recentFoci}\n` +
            "حالا بهترین برنامه‌ی تمرینیِ امروز را طراحی کن.",
        },
      ],
      // timeout طولانی‌تر چون هیچ پراکسی‌ای این connection را نمی‌بندد
      { temperature: 0.5, maxTokens: 1200, timeoutMs: 55_000, tag: "coach_workout" }
    );

    const plan = sanitize(raw, today);
    if (!plan.blocks.length) {
      await db.from("workout_jobs").update({ status: "error", error_msg: "برنامه‌ی معتبری ساخته نشد." }).eq("id", jobId);
      return;
    }

    const { error } = await db
      .from("workout_plans")
      .upsert(
        {
          user_id: uid,
          plan_on: today,
          focus: plan.focus,
          intensity: plan.intensity,
          total_minutes: plan.total_minutes,
          plan,
          completed: false,
        },
        { onConflict: "user_id,plan_on" }
      );

    if (error) {
      await db.from("workout_jobs").update({ status: "error", error_msg: error.message }).eq("id", jobId);
      return;
    }

    await db.from("workout_jobs").update({ status: "done" }).eq("id", jobId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطای ناشناخته در ساختِ برنامه.";
    console.error("[workout_async]", msg);
    await db.from("workout_jobs").update({ status: "error", error_msg: msg }).eq("id", jobId);
  }
}

// ── GET — وضعیتِ اتاق + polling ──────────────────────────────────────────────
export async function GET(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;

  const url = new URL(req.url);
  const jobId = url.searchParams.get("job");

  // ── حالتِ polling: ?job=<uuid> ─────────────────────────────────────────────
  if (jobId) {
    const { data: job } = await a.db
      .from("workout_jobs")
      .select("status, error_msg, created_at")
      .eq("id", jobId)
      .eq("user_id", a.uid)
      .maybeSingle();

    if (!job) return bad("Job not found", 404);

    // اگر job بیش از ۲ دقیقه pending مانده، احتمالاً container ری‌استارت کرده
    const ageMs = Date.now() - new Date(job.created_at as string).getTime();
    if (job.status === "pending" && ageMs > 120_000) {
      return ok({ status: "error", error: "ساختِ برنامه به مشکل خورد. دوباره تلاش کن." });
    }

    if (job.status === "done") {
      const { data: planRow } = await a.db
        .from("workout_plans")
        .select("plan, plan_on, completed")
        .eq("user_id", a.uid)
        .eq("plan_on", todayISO())
        .maybeSingle();
      return ok({ status: "done", plan: planRow ? rowToPlan(planRow as never) : null });
    }

    return ok({ status: job.status, error: (job.error_msg as string) ?? null });
  }

  // ── حالتِ معمول: بازگرداندنِ وضعیتِ امروز ──────────────────────────────────
  const today = todayISO();
  const [{ data: profile }, weightRes, planRes] = await Promise.all([
    a.db.from("profiles").select("*").eq("user_id", a.uid).maybeSingle(),
    a.db.from("health_metrics").select("value").eq("user_id", a.uid).eq("kind", "weight").order("recorded_on", { ascending: false }).limit(1),
    a.db.from("workout_plans").select("plan, plan_on, completed").eq("user_id", a.uid).eq("plan_on", today).maybeSingle(),
  ]);

  const prefs = {
    fitness_goal: profile?.fitness_goal ?? null,
    fitness_level: profile?.fitness_level ?? null,
    workout_days: profile?.workout_days ?? null,
    workout_location: profile?.workout_location ?? null,
    workout_equipment: profile?.workout_equipment ?? null,
    workout_minutes: profile?.workout_minutes ?? null,
    workout_limits: profile?.workout_limits ?? null,
  };

  const needs = requiredNeeds(profile as Record<string, unknown> | null);
  const latestWeight = weightRes.data?.[0]?.value != null ? Number(weightRes.data[0].value) : null;

  return ok({
    prefs,
    needs,
    has_body: latestWeight != null && !!profile?.height_cm,
    plan: planRes.data ? rowToPlan(planRes.data as never) : null,
  });
}

// ── POST — ثبتِ job و شروعِ پردازشِ پس‌زمینه ──────────────────────────────────
export async function POST() {
  const a = await authed();
  if ("error" in a) return a.error;
  const guard = await guardAI(a.db, a.uid, "coach_workout");
  if ("error" in guard) return guard.error;

  const today = todayISO();

  // بررسیِ سریعِ پروفایل — بدونِ AI
  const { data: profile } = await a.db.from("profiles").select("*").eq("user_id", a.uid).maybeSingle();
  const needs = requiredNeeds(profile as Record<string, unknown> | null);
  if (needs.length) return ok({ needs });

  // ثبتِ job
  const jobId = crypto.randomUUID();
  const { error: insertErr } = await a.db.from("workout_jobs").insert({
    id: jobId,
    user_id: a.uid,
    plan_on: today,
    status: "pending",
  });
  if (insertErr) return bad(insertErr.message, 500);

  // شروعِ پردازشِ پس‌زمینه — response قبل از اتمامِ این تابع برگردانده می‌شود
  void generateWorkoutAsync(a.uid, jobId, today);

  return ok({ job_id: jobId, status: "pending" });
}

// ── PUT — علامت‌زدن به‌عنوان انجام‌شده ───────────────────────────────────────
export async function PUT(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const b = await req.json().catch(() => ({}));
  const today = todayISO();

  const { data, error } = await a.db
    .from("workout_plans")
    .update({ completed: !!b.completed })
    .eq("user_id", a.uid)
    .eq("plan_on", today)
    .select("plan, plan_on, completed")
    .maybeSingle();

  if (error) return bad(error.message, 500);
  if (!data) return bad("برنامه‌ای برای امروز پیدا نشد.", 404);
  return ok({ plan: rowToPlan(data as never) });
}
