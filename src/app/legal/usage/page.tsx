import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { USAGE, USAGE_INTRO } from "@/components/legal/content";

export const metadata: Metadata = { title: "Usage Policy" };

export default function Page() {
  return <LegalPage title="Usage Policy" intro={USAGE_INTRO} sections={USAGE} />;
}
