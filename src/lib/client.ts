"use client";

/** خطای API که status و code پاسخ را همراه دارد (مثلاً برای تشخیصِ اتمامِ اعتبار). */
export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/** In-flight deduplication map — shared across all concurrent apiGet calls. */
const inFlight = new Map<string, Promise<unknown>>();

export async function apiGet<T = unknown>(url: string): Promise<T> {
  if (inFlight.has(url)) return inFlight.get(url) as Promise<T>;
  const p = fetch(url, { cache: "no-store" })
    .then(async (r) => {
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new ApiError(j.error || "خطا در دریافت اطلاعات", r.status, j.code);
      return j as T;
    })
    .finally(() => inFlight.delete(url));
  inFlight.set(url, p);
  return p as Promise<T>;
}

export async function apiSend<T = any>(
  url: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown
): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(j.error || "خطا در ثبت اطلاعات", r.status, j.code);
  return j as T;
}
