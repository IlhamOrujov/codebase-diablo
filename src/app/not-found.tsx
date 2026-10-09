import type { Metadata } from "next";
import { StatusPage } from "@/components/StatusPage";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return (
    <StatusPage title="Page not found">
      <p>There is nothing at this address. If you followed a link to an investigation, it may have been created in another browser or tab.</p>
    </StatusPage>
  );
}
