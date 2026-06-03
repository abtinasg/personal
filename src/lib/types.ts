export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

export type FitnessGoal = "lose_fat" | "build_muscle" | "strength" | "endurance" | "general";
export type FitnessLevel = "beginner" | "intermediate" | "advanced";
export type WorkoutLocation = "gym" | "home" | "outdoor";

export type Profile = {
  user_id: string;
  daily_calorie_goal: number;
  monthly_budget: number;
  water_goal_ml: number;
  weight_goal: number | null;
  currency: string;
  height_cm: number | null;
  sex: "male" | "female" | null;
  birth_year: number | null;
  activity_level: ActivityLevel | null;
  // ترجیحاتِ ورزشی
  fitness_goal: FitnessGoal | null;
  fitness_level: FitnessLevel | null;
  workout_days: number | null;
  workout_location: WorkoutLocation | null;
  workout_equipment: string | null;
  workout_minutes: number | null;
  workout_limits: string | null;
};

export type Meal = {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  eaten_on: string;
  created_at: string;
};

export type Transaction = {
  id: string;
  kind: "income" | "expense";
  amount: number;
  category: string;
  note: string | null;
  occurred_on: string;
  created_at: string;
};

/** واحدِ هدفِ خرید — هدف را برحسبِ دارایی نگه می‌داریم تا تورم بی‌اثرش نکند. */
export type GoalDenom = "toman" | "usd" | "gold" | "coin";

export type PurchaseGoal = {
  id: string;
  title: string;
  emoji: string;
  denom: GoalDenom;
  target_native: number;
  saved_toman: number;
  target_date: string | null;
  note: string | null;
  status: "active" | "reached" | "archived";
  created_at: string;
};

/** نرخِ بازارِ آزاد (به تومان) — برای آموزشِ «فکرکردن به دارایی به‌جای تومان». */
export type MarketRates = {
  usd: number | null;      // دلار آمریکا (تومان)
  gold: number | null;     // هر گرم طلای ۱۸ عیار (تومان)
  coin: number | null;     // سکه‌ی امامی (تومان)
  btc: number | null;      // بیت‌کوین (تومان)
  updated_at: string | null;
  source: string;          // "live" | "fallback" | "manual"
};

export type HealthMetric = {
  id: string;
  kind: "weight" | "water" | "sleep" | "steps";
  value: number;
  recorded_on: string;
  created_at: string;
};

export type Habit = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  target_per_day: number;
  archived: boolean;
  created_at: string;
  identity_id: string | null;
  cue: string | null;
  min_version: string | null;
};

export type Identity = {
  id: string;
  name: string;
  statement: string | null;
  emoji: string;
  color: string;
  archived: boolean;
  created_at: string;
  // محاسبه‌شده در API:
  vote_total: number;
  vote_week: number;
  habit_count: number;
};

export type Milestone = {
  id: string;
  mission_id: string;
  title: string;
  order_index: number;
  reached_at: string | null;
};

export type Mission = {
  id: string;
  title: string;
  why: string | null;
  emoji: string;
  color: string;
  identity_id: string | null;
  start_on: string;
  end_on: string | null;
  target_label: string | null;
  target_value: number | null;
  target_unit: string | null;
  status: "active" | "completed" | "abandoned";
  created_at: string;
  milestones: Milestone[];
  habit_ids: string[];
};

export type HabitLog = {
  id: string;
  habit_id: string;
  done_on: string;
  count: number;
};

export type Mood = {
  id: string;
  score: number;
  note: string | null;
  recorded_on: string;
};

export type Reward = {
  id: string;
  title: string;
  emoji: string;
  color: string;
  streak_days: number;
  archived: boolean;
  created_at: string;
  // محاسبه‌شده در API:
  claimable: boolean;
  claimed_in_streak: boolean;
  last_claimed_on: string | null;
  total_claims: number;
};

export type Tab =
  | "home"
  | "missions"
  | "habit"
  | "health"
  | "more"
  | "calorie"
  | "budget"
  | "identities"
  | "rewards"
  | "workout";

// ---------- برنامه‌ی ورزشی ----------
export type WorkoutBlockKind = "warmup" | "strength" | "aerobic" | "cooldown";

export type Exercise = {
  name: string;
  sets: number;
  reps: string;   // مثل «۸ تا ۱۲» یا «۳۰ ثانیه»
  rest: string;   // مثل «۹۰ ثانیه»
  note?: string;
};

export type WorkoutBlock = {
  title: string;
  kind: WorkoutBlockKind;
  duration_min: number;
  exercises: Exercise[];
};

export type WorkoutPlan = {
  plan_on: string;
  focus: string;
  headline: string;
  summary: string;
  total_minutes: number;
  intensity: string;
  blocks: WorkoutBlock[];
  coach_notes: string[];
  completed: boolean;
};

/** سطح هویت از روی تعداد رأی‌ها (هر تیک عادت = یک رأی). */
export function identityLevel(votes: number): { level: number; inLevel: number; needed: number; progress: number } {
  // آستانه‌ی هر سطح به‌صورت تصاعدی: 0,5,15,30,50,75,105,...
  let level = 1;
  let base = 0;
  let step = 5;
  while (votes >= base + step) {
    base += step;
    level += 1;
    step += 5;
  }
  const inLevel = votes - base;
  return { level, inLevel, needed: step, progress: Math.min(1, inLevel / step) };
}
