import type { Metadata } from "next";
import { ExperimentsPage } from "@/components/pages/Library";

export const metadata: Metadata = { title: "Experiments" };

export default function Page() {
  return <ExperimentsPage />;
}
