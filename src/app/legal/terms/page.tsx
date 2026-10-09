import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { TERMS, TERMS_INTRO } from "@/components/legal/content";

export const metadata: Metadata = { title: "Terms of Service" };

export default function Page() {
  return <LegalPage title="Terms of Service" intro={TERMS_INTRO} sections={TERMS} />;
}
