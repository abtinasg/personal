import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null });

  const db = getServiceClient();
  const { data: user } = await db
    .from("users")
    .select("id, username, display_name")
    .eq("id", session.uid)
    .maybeSingle();

  return NextResponse.json({ user });
}
