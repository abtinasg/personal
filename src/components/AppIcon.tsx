"use client";

import {
  Star, Dumbbell, BookOpen, Wind, Footprints, Palette, Briefcase, Brain,
  Heart, Flame, Sprout, PenLine, CheckCircle2, Droplet, Salad, Bed,
  CigaretteOff, Brush, Target, Smile, Sun,
  Utensils, UtensilsCrossed, Apple, Egg,
  Car, ShoppingBag, ReceiptText, PartyPopper, Pill, Laptop, Gift, Package,
  Scale, Compass, Rocket, Trophy, Flag, Repeat, Vote, Wallet, Banknote,
  BarChart3, Lightbulb, Calculator, Hourglass, Clock, Feather, Sparkles,
  AlertTriangle, Circle,
  Download, Smartphone, Share, Plus, Camera, ChevronRight, ChevronLeft,
  Coins, DollarSign, CircleDollarSign, TrendingUp, Bitcoin, Landmark, Gem,
  type LucideIcon,
} from "lucide-react";

/**
 * رجیستری مرکزی آیکون‌ها. در سراسر اپ به‌جای ایموجی، «کلید» ذخیره و رندر می‌شود.
 * فیلدهای دیتابیس (mission.emoji و …) همان نام را دارند ولی مقدارشان یک کلید است.
 */
const REGISTRY: Record<string, LucideIcon> = {
  // — هویت‌ها —
  star: Star,
  strength: Dumbbell,
  study: BookOpen,
  calm: Wind,
  run: Footprints,
  art: Palette,
  work: Briefcase,
  brain: Brain,
  heart: Heart,
  flame: Flame,
  sprout: Sprout,
  write: PenLine,
  // — عادت‌ها —
  check: CheckCircle2,
  water: Droplet,
  salad: Salad,
  sleep: Bed,
  "no-smoke": CigaretteOff,
  clean: Brush,
  target: Target,
  dental: Smile,
  sun: Sun,
  // — وعده‌ها —
  breakfast: Egg,
  lunch: Utensils,
  dinner: UtensilsCrossed,
  snack: Apple,
  // — دسته‌های بودجه —
  food: Utensils,
  transport: Car,
  shopping: ShoppingBag,
  bills: ReceiptText,
  fun: PartyPopper,
  health: Pill,
  salary: Briefcase,
  freelance: Laptop,
  gift: Gift,
  other: Package,
  // — ثبت سریع / سلامتی —
  meal: Utensils,
  expense: Banknote,
  income: Wallet,
  weight: Scale,
  steps: Footprints,
  // — تزئینی / UI —
  camera: Camera,
  "chevron-right": ChevronRight,
  "chevron-left": ChevronLeft,
  compass: Compass,
  rocket: Rocket,
  sparkles: Sparkles,
  celebrate: PartyPopper,
  trophy: Trophy,
  flag: Flag,
  repeat: Repeat,
  vote: Vote,
  wallet: Wallet,
  chart: BarChart3,
  idea: Lightbulb,
  calculator: Calculator,
  duration: Hourglass,
  cue: Clock,
  feather: Feather,
  alert: AlertTriangle,
  download: Download,
  phone: Smartphone,
  share: Share,
  plus: Plus,
  // — سرمایه‌گذاری —
  invest: TrendingUp,
  gold: Coins,
  gem: Gem,
  dollar: DollarSign,
  coin: CircleDollarSign,
  bitcoin: Bitcoin,
  estate: Landmark,
};

/** نگاشت سازگاری: داده‌های قدیمی که هنوز ایموجی ذخیره شده‌اند. */
const LEGACY_EMOJI: Record<string, string> = {
  "🌟": "star", "💪": "strength", "📚": "study", "🧘": "calm", "🏃": "run",
  "🎨": "art", "💼": "work", "🧠": "brain", "❤": "heart", "🔥": "flame",
  "🌱": "sprout", "✍": "write", "✅": "check", "💧": "water", "🥗": "salad",
  "😴": "sleep", "🚭": "no-smoke", "🧹": "clean", "🎯": "target", "🦷": "dental",
  "☀": "sun", "🚀": "rocket", "🍳": "breakfast", "🍚": "lunch", "🍽": "dinner",
  "🍎": "snack", "🍔": "food", "🚗": "transport", "🛍": "shopping", "🧾": "bills",
  "🎉": "celebrate", "💊": "health", "💻": "freelance", "🎁": "gift", "📦": "other",
  "💸": "expense", "💰": "wallet", "⚖": "weight", "👟": "steps", "🧭": "compass",
  "🚩": "flag", "🔁": "repeat", "🗳": "vote", "📊": "chart", "💡": "idea",
  "🧮": "calculator", "⏳": "duration", "⏰": "cue", "🪶": "feather", "✨": "sparkles",
};

function resolve(name: string | undefined | null): LucideIcon {
  if (!name) return Circle;
  if (REGISTRY[name]) return REGISTRY[name];
  const stripped = name.replace(/️/g, "").trim();
  if (REGISTRY[stripped]) return REGISTRY[stripped];
  const key = LEGACY_EMOJI[name] || LEGACY_EMOJI[stripped] || LEGACY_EMOJI[[...stripped][0] || ""];
  return (key && REGISTRY[key]) || Circle;
}

export function AppIcon({
  name,
  size = 24,
  strokeWidth = 2,
  className,
  style,
}: {
  name: string | undefined | null;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const Cmp = resolve(name);
  return <Cmp size={size} strokeWidth={strokeWidth} className={className} style={style} absoluteStrokeWidth />;
}

/** پالت انتخابی هویت‌ها. */
export const IDENTITY_ICONS = [
  "star", "strength", "study", "calm", "run", "art",
  "work", "brain", "heart", "flame", "sprout", "write",
];

/** پالت انتخابی عادت‌ها. */
export const HABIT_ICONS = [
  "check", "strength", "study", "calm", "run", "water", "salad",
  "sleep", "no-smoke", "clean", "write", "target", "dental", "sun",
];
