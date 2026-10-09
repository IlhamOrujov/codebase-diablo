import type { Metadata } from "next";
import { DatasetsPage } from "@/components/pages/Library";

export const metadata: Metadata = { title: "Datasets" };

export default function Page() {
  return <DatasetsPage />;
}
