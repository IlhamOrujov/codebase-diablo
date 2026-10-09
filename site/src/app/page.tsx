import type { Metadata } from "next";
import { CtaBand } from "@/components/CtaBand";
import { Hero } from "@/components/home/Hero";
import { Investigation } from "@/components/home/Investigation";
import { Knowledge } from "@/components/home/Knowledge";
import { Loop } from "@/components/home/Loop";
import { Principle } from "@/components/home/Principle";
import { SiteIntro } from "@/components/home/SiteIntro";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  path: "/",
  description:
    "Diablo AI investigates AI systems: which change moved a score, and how sure you can be. Every number is computed by code, never written by the model.",
});

export default function HomePage() {
  return (
    <>
      <SiteIntro />
      <Hero />
      <Loop />
      <Principle />
      <Investigation />
      <Knowledge />
      <CtaBand />
    </>
  );
}
