import type { Metadata } from "next";
import { InvestigationsPage } from "@/components/pages/Library";

export const metadata: Metadata = { title: "Investigations" };

export default function Page() {
  return <InvestigationsPage />;
}
