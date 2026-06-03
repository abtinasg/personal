"use client";

import { createContext, useContext } from "react";
import type { Profile } from "@/lib/types";

export type AppCtx = {
  profile: Profile | null;
  /** پروفایل را دوباره از سرور می‌خواند (مثلاً بعد از تغییرِ اهداف). */
  reloadProfile: () => void;
  /** با هر «ثبتِ سریعِ» موفق یک‌واحد زیاد می‌شود تا صفحه‌ی فعلی داده‌اش را تازه کند. */
  refreshKey: number;
  username: string;
  displayName: string;
};

const Ctx = createContext<AppCtx | null>(null);

export const AppProvider = Ctx.Provider;

export function useApp(): AppCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp باید درونِ AppProvider استفاده شود");
  return v;
}
