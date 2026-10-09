import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { PRIVACY, PRIVACY_INTRO } from "@/components/legal/content";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function Page() {
  return <LegalPage title="Privacy Policy" intro={PRIVACY_INTRO} sections={PRIVACY} />;
}
