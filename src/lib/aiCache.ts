import type { PgClient } from "@/lib/pg";

export async function getCached<T>(db: PgClient, key: string): Promise<T | null> {
  try {
    const { data } = await db
      .from("ai_cache")
      .select("value")
      .eq("cache_key", key)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    return data ? (data.value as T) : null;
  } catch {
    return null;
  }
}

export async function setCached(
  db: PgClient,
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    await db
      .from("ai_cache")
      .upsert({ cache_key: key, value, expires_at: expiresAt }, { onConflict: "cache_key" });
  } catch {
    /* best-effort — a cache miss is never fatal */
  }
}

/** Seconds remaining until UTC midnight (end of calendar day). */
export function secondsUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  return Math.ceil((midnight.getTime() - now.getTime()) / 1000);
}

/** Normalise a free-text description into a stable cache key segment. */
export function descKey(text: string): string {
  return text.trim().toLowerCase().slice(0, 200);
}
