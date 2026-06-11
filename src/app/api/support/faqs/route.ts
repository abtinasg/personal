import { getServiceClient } from "@/lib/supabase";
import { ok, bad } from "@/lib/api";

export const runtime = "nodejs";
export const revalidate = 300; // FAQs change infrequently; revalidate every 5 minutes

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
  return ok({ faqs: data ?? [] });
}
