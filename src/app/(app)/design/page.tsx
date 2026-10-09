import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DesignSystem } from "@/components/pages/DesignSystem";

export const metadata: Metadata = { title: "Design system" };

/** Development only: a production build answers 404. */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DesignSystem />;
}
