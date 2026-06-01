import type { Metadata } from "next";
import Landing from "./Landing";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "یک‌درصد";

export const metadata: Metadata = {
  title: { absolute: `${appName} — هر روز یک‌درصد بهتر` },
  description:
    "یک‌درصد اپِ ساختنِ هویت و رشدِ مرکب است: هویت‌ها، ماموریت‌ها، عادت‌های اتمی، کالریِ هوشمند، بودجه، سلامتی، تمرین و یک مربیِ همیشه‌همراه — ورود بی‌رمز با پسکی.",
};

export default function LandingPage() {
  return <Landing />;
}
