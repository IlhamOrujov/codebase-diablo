import type { Metadata } from "next";
import { ReportsPage } from "@/components/pages/Library";

export const metadata: Metadata = { title: "Reports" };

export default function Page() {
  return <ReportsPage />;
}
