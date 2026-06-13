import type { Metadata } from "next";
import { Suspense } from "react";
import StartPage from "./StartPage";

export const metadata: Metadata = {
  title: "جوانه — مربی هوشمند فارسیت",
  description:
    "جوانه هر روز کنارته — کالری، بودجه و عادت‌هات رو با هم مدیریت می‌کنه. بدون قضاوت. بدون سرزنش. رایگان شروع کن.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <Suspense>
      <StartPage />
    </Suspense>
  );
}
