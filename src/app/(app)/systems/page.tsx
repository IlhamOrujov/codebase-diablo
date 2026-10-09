import type { Metadata } from "next";
import { SystemsPage } from "@/components/pages/Library";

export const metadata: Metadata = { title: "AI systems" };

export default function Page() {
  return <SystemsPage />;
}
