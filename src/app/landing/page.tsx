import type { Metadata } from "next";
import Landing from "./Landing";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "امروز";

export const metadata: Metadata = {
  title: { absolute: `${appName} — همین امروز` },
  description:
    "امروز اپِ زندگیِ آگاهانه است: عمرت جمعِ همین «امروز»هاست — عادت‌های اتمی، کالریِ هوشمند، بودجه، سلامتی، تمرین و یک مربیِ همیشه‌همراه. ورود بی‌رمز با پسکی.",
};

export default function LandingPage() {
  return <Landing />;
}
