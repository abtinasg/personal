import { authed, ok } from "@/lib/api";
import { getMarketRates } from "@/lib/market";

export const runtime = "nodejs";

export async function GET() {
  const a = await authed();
  if ("error" in a) return a.error;
  const rates = await getMarketRates();
  return ok({ rates });
}
