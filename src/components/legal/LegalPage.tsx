import Link from "next/link";
import { Mark } from "@/components/brand/Mark";
import { BRAND, isPlaceholder } from "@/lib/brand";
import { longDate } from "@/lib/format";

export interface LegalSection {
  id: string;
  title: string;
  body: React.ReactNode;
}

/** A visible placeholder for details the owner has not decided yet. */
export function TBD({ value }: { value: string }) {
  return isPlaceholder(value) ? <mark className="rounded-[3px] bg-sunken px-1 text-ink">{value}</mark> : <>{value}</>;
}

export function LegalPage({ title, intro, sections }: { title: string; intro: React.ReactNode; sections: LegalSection[] }) {
  return (
    <div className="min-h-dvh bg-bg">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="no-print border-b border-line">
        <div className="mx-auto flex h-14 max-w-[1080px] items-center gap-3 px-4 sm:px-6">
          <Link href="/home" className="flex items-center gap-2 rounded-[6px] text-ink">
            <Mark size={20} className="text-burgundy dark:text-accent-text" />
            <span className="text-[14px] font-medium">{BRAND.name}</span>
          </Link>
          <nav aria-label="Legal" className="ml-auto flex gap-4 text-[13px]">
            <Link href="/legal/terms" className="text-ink-2 hover:text-ink">
              Terms
            </Link>
            <Link href="/legal/privacy" className="text-ink-2 hover:text-ink">
              Privacy
            </Link>
            <Link href="/legal/usage" className="text-ink-2 hover:text-ink">
              Usage
            </Link>
          </nav>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1080px] gap-10 px-4 pb-24 pt-10 sm:px-6 lg:grid-cols-[minmax(0,680px)_220px] lg:justify-between">
        <main id="main" className="min-w-0">
          <p className="rounded-[6px] border border-line bg-subtle px-3 py-2 text-[13px] text-ink-2">Draft, pending legal review.</p>
          <h1 className="mt-6 text-[32px] font-semibold leading-[40px] tracking-[-0.022em] text-ink">{title}</h1>
          <p className="mt-2 text-[13px] text-ink-3">
            Last updated <time dateTime={BRAND.legalLastUpdated}>{longDate(BRAND.legalLastUpdated)}</time>
          </p>
          <div className="mt-6 text-[16px] leading-[26px] text-ink">{intro}</div>
          {sections.map((s) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="print-break-avoid scroll-mt-6">
              <h2 id={`${s.id}-h`} className="mt-10 font-serif text-[22px] font-normal leading-[30px] text-ink">
                {s.title}
              </h2>
              <div className="mt-3 space-y-3 text-[16px] leading-[26px] text-ink [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">{s.body}</div>
            </section>
          ))}
        </main>
        <nav aria-label="Contents" className="no-print hidden lg:block">
          <div className="sticky top-8">
            <div className="text-[12px] text-ink-3">Contents</div>
            <ol className="mt-2 space-y-1.5 text-[13px]">
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="text-ink-2 hover:text-ink">
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>
      </div>
    </div>
  );
}
