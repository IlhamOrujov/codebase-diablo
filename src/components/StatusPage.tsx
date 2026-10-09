import Link from "next/link";
import { Mark } from "@/components/brand/Mark";

/** Shared layout for 404 and error pages: calm, branded, honours the theme. */
export function StatusPage({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-bg px-4 py-16">
      <div className="w-full max-w-[440px] text-center">
        <Mark size={40} className="mx-auto text-burgundy dark:text-accent-text" />
        <h1 className="mt-6 text-[30px] font-semibold leading-[38px] tracking-[-0.02em] text-ink">{title}</h1>
        <div className="mt-3 text-ink-2">{children}</div>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {actions ?? (
            <>
              <Link href="/home" className="inline-flex h-9 items-center rounded-[6px] bg-ink px-3 font-medium text-bg hover:bg-ink/90">
                Go to Home
              </Link>
              <Link href="/investigations" className="inline-flex h-9 items-center rounded-[6px] border border-line-strong bg-surface px-3 font-medium text-ink hover:bg-subtle">
                All investigations
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
