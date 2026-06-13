import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { logEvent, type EventName } from "@/lib/events";

export const runtime = "nodejs";

const ALLOWED: Set<EventName> = new Set([
  "landing_view",
  "guest_start",
  "signup",
  "onboarding_complete",
  "first_coach_chat",
  "checkout_start",
]);

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/** endpoint عمومی برای ثبتِ رویدادهای funnel از کلاینت.
 *  فقط رویدادهای مجاز را قبول می‌کند تا جلویِ spam گرفته شود. */
export async function POST(req: Request) {
  let name: string, props: Record<string, unknown> | undefined;
  try {
    ({ name, props } = await req.json());
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  if (!ALLOWED.has(name as EventName)) {
    return NextResponse.json({ error: "unknown event" }, { status: 400 });
  }

  const session = await getSession();
  const db = getServiceClient();
  await logEvent(db, name as EventName, {
    userId: session?.uid ?? null,
    props,
    ip: clientIp(req),
  });

  return NextResponse.json({ ok: true });
}
