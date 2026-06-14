import { getServiceClient } from "@/lib/supabase";
import { bad } from "@/lib/api";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
// این route موقعِ build به DATABASE_URL نیاز دارد که در مرحله‌ی Docker build نیست؛
// پس نباید prerender شود. به‌جای revalidate، کشِ ۵ دقیقه‌ای را با هدرِ Cache-Control
// روی پاسخ می‌گذاریم تا CDN/مرورگر کش کند بدونِ اینکه build بترکد.
export const dynamic = "force-dynamic";

/** GET — لیستِ عمومیِ FAQها (بدون احراز هویت). برای help-center داخلِ اپ. */
export async function GET() {
  const db = getServiceClient();
  const { data, error } = await db
    .from("support_faqs")
    .select("id, slug, question, short_answer, body, category, order_index")
    .eq("published", true)
    .order("category", { ascending: true })
    .order("order_index", { ascending: true });
  if (error) return bad(error.message, 500);
  return NextResponse.json(
    { faqs: data ?? [] },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
  );
}
