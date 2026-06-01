import { authed, ok, bad } from "@/lib/api";
import { aiJSON } from "@/lib/openrouter";

export const runtime = "nodejs";

export type MissionPlan = {
  title: string;
  why: string;
  emoji: string;
  color: string;
  duration_days: number;
  target_label: string | null;
  target_value: number | null;
  target_unit: string | null;
  identity: { name: string; statement: string; emoji: string };
  milestones: string[];
  habits: { name: string; emoji: string; cue: string; min_version: string }[];
};

const COLORS = ["#5e5ce6", "#0a84ff", "#34c759", "#ff9f0a", "#ff2d55", "#af52de", "#30b0c7"];

// کلیدهای مجاز آیکون (هم‌راستا با رجیستری AppIcon). به‌جای ایموجی، یکی از این کلیدها ذخیره می‌شود.
const MISSION_ICONS = ["rocket", "flag", "target", "trophy", "flame", "sparkles", "compass", "star", "sprout", "heart"];
const IDENTITY_ICONS = ["star", "strength", "study", "calm", "run", "art", "work", "brain", "heart", "flame", "sprout", "write"];
const HABIT_ICONS = ["check", "strength", "study", "calm", "run", "water", "salad", "sleep", "no-smoke", "clean", "write", "target", "dental", "sun"];

export async function POST(req: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  const b = await req.json().catch(() => ({}));
  const goal = String(b.goal || "").trim();
  if (!goal) return bad("هدفت رو بنویس تا ماموریت بسازم.");

  try {
    const plan = await aiJSON<MissionPlan>(
      [
        {
          role: "system",
          content:
            "تو یک مربی عادت‌سازی هستی که بر پایه‌ی کتاب «عادت‌های اتمی» جیمز کلیر کار می‌کنی. " +
            "اصل کارت: هدف مهم نیست، هویت مهمه؛ هر عادت کوچک یک «رأی» به آدمی‌ست که کاربر می‌خواد بشه. " +
            "بر اساس هدف کاربر یک «ماموریت» انگیزشی و واقع‌بینانه طراحی کن. " +
            "همه‌ی متن‌ها باید فارسی، گرم، شخصی و کوتاه باشند. " +
            "عادت‌ها باید روزانه، مشخص و کوچک باشند؛ برای هرکدام یک «نشانه» (cue: کِی/کجا انجام بشه) و یک «نسخه‌ی حداقلی» (نسخه‌ی ۲ دقیقه‌ای که حتی روزهای بد هم شدنیه) بده. " +
            "بین ۳ تا ۵ عادت و بین ۳ تا ۵ نقطه‌عطف بده. " +
            "duration_days یک عدد منطقی (مثلاً ۳۰، ۶۶، ۹۰، ۱۰۰) بده. اگر هدف قابل‌اندازه‌گیری بود target_label و target_value و target_unit را پر کن وگرنه null بگذار. " +
            "فقط یک JSON معتبر با این ساختار برگردان (بدون توضیح اضافه): " +
            '{"title":string,"why":string,"emoji":string,"color":string,"duration_days":number,' +
            '"target_label":string|null,"target_value":number|null,"target_unit":string|null,' +
            '"identity":{"name":string,"statement":string,"emoji":string},' +
            '"milestones":string[],' +
            '"habits":[{"name":string,"emoji":string,"cue":string,"min_version":string}]}. ' +
            "statement جمله‌ی اول‌شخص باشد مثل «من کسی‌ام که هر روز به بدنش می‌رسه». " +
            "مهم: فیلدهای emoji ایموجی نیستند؛ باید دقیقاً یکی از «کلیدهای آیکون» زیر باشند (رشته‌ی انگلیسی، عیناً از همین فهرست‌ها): " +
            `emoji ماموریت یکی از: ${MISSION_ICONS.join(", ")}. ` +
            `identity.emoji یکی از: ${IDENTITY_ICONS.join(", ")}. ` +
            `habits[].emoji یکی از: ${HABIT_ICONS.join(", ")}. ` +
            "متناسب‌ترین کلید را برای معنای هر مورد انتخاب کن.",
        },
        { role: "user", content: goal },
      ],
      { temperature: 0.6, maxTokens: 1100 }
    );

    // پاکسازی و محدودسازی
    const color = COLORS.includes(plan.color) ? plan.color : COLORS[Math.floor(Math.random() * COLORS.length)];
    const clean: MissionPlan = {
      title: String(plan.title || "ماموریت تازه").slice(0, 80),
      why: String(plan.why || "").slice(0, 300),
      emoji: pickIcon(plan.emoji, MISSION_ICONS, "rocket"),
      color,
      duration_days: clampInt(plan.duration_days, 7, 365, 90),
      target_label: plan.target_label ? String(plan.target_label).slice(0, 40) : null,
      target_value: plan.target_value != null && !isNaN(Number(plan.target_value)) ? Number(plan.target_value) : null,
      target_unit: plan.target_unit ? String(plan.target_unit).slice(0, 20) : null,
      identity: {
        name: String(plan.identity?.name || "").slice(0, 60),
        statement: String(plan.identity?.statement || "").slice(0, 160),
        emoji: pickIcon(plan.identity?.emoji, IDENTITY_ICONS, "star"),
      },
      milestones: (Array.isArray(plan.milestones) ? plan.milestones : [])
        .map((m) => String(m).trim())
        .filter(Boolean)
        .slice(0, 6),
      habits: (Array.isArray(plan.habits) ? plan.habits : [])
        .slice(0, 6)
        .map((h) => ({
          name: String(h.name || "").slice(0, 60),
          emoji: pickIcon(h.emoji, HABIT_ICONS, "check"),
          cue: String(h.cue || "").slice(0, 80),
          min_version: String(h.min_version || "").slice(0, 80),
        }))
        .filter((h) => h.name),
    };

    return ok({ plan: clean });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "ساخت ماموریت با خطا روبه‌رو شد.", 502);
  }
}

function clampInt(v: any, min: number, max: number, fallback: number) {
  const n = Math.round(Number(v));
  if (isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
function pickIcon(v: any, allowed: string[], fallback: string): string {
  const s = String(v || "").trim().toLowerCase();
  return allowed.includes(s) ? s : fallback;
}
