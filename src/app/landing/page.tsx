import type { Metadata } from "next";
import Landing from "./Landing";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "امروز";

export const metadata: Metadata = {
  title: { absolute: `${appName} — همین امروز` },
  description:
    "«امروز» اپِ ساختنِ خود است: عادت‌های اتمی، کالریِ هوشمند، بودجه، سلامتی و تمرین — همه یک‌جا، با «جوانه»، مربیِ هوشمندِ فارسی‌زبانت. ورودِ بی‌رمز با پسکی، شروعِ رایگان.",
};

export default function LandingPage() {
  return <Landing />;
}
