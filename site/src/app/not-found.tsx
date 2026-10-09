import type { Metadata } from "next";
import Link from "next/link";
import { Mark } from "@/components/Mark";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <section className="mx-auto grid max-w-6xl place-items-center px-4 py-32 text-center sm:px-6">
      <span className="grid size-16 place-items-center rounded-[1.1rem] bg-burgundy text-cream">
        <Mark size={40} />
      </span>
      <h1 className="t-title mt-8">Nothing measured here.</h1>
      <p className="t-lead mt-3 text-ink-2">This page doesn’t exist.</p>
      <Link href="/" className="press t-callout mt-8 rounded-full bg-accent px-5 py-2.5 font-semibold text-accent-ink">
        Back to the overview
      </Link>
    </section>
  );
}
