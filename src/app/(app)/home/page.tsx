import type { Metadata } from "next";
import { Home } from "@/components/home/Home";

export const metadata: Metadata = { title: "Home" };

export default function Page() {
  return <Home />;
}
