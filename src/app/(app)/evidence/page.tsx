import type { Metadata } from "next";
import { EvidencePage } from "@/components/pages/Library";

export const metadata: Metadata = { title: "Evidence" };

export default function Page() {
  return <EvidencePage />;
}
