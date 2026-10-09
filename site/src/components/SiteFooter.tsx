import Link from "next/link";
import { Mark } from "@/components/Mark";
import { APP_URL, NAV, SITE } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-[0.6rem] bg-burgundy text-cream">
              <Mark size={20} />
            </span>
            <span className="text-[1.0625rem] font-semibold tracking-[-0.02em]">{SITE.company}</span>
          </div>
          <p className="t-callout mt-4 max-w-xs text-ink-2">{SITE.tagline} Intelligence that improves intelligence.</p>
        </div>
        <FooterList title="Company" items={[{ href: "/", label: "Overview" }, ...NAV]} />
        <div>
          <h2 className="t-overline text-ink-3">Product</h2>
          <ul className="t-callout mt-4 space-y-2.5">
            <li>
              <a href={APP_URL} className="text-ink-2 hover:text-ink">
                Open Diablo
              </a>
            </li>
            <li>
              <Link href="/#loop" className="text-ink-2 hover:text-ink">
                How it works
              </Link>
            </li>
            <li>
              <Link href="/pricing#faq" className="text-ink-2 hover:text-ink">
                Questions
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t">
        <div className="t-caption mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-ink-3 sm:px-6">
          <span>© 2026 {SITE.company}</span>
          <span>The AI reasons. The system measures.</span>
        </div>
      </div>
    </footer>
  );
}

function FooterList({ title, items }: { title: string; items: readonly { href: string; label: string }[] }) {
  return (
    <div>
      <h2 className="t-overline text-ink-3">{title}</h2>
      <ul className="t-callout mt-4 space-y-2.5">
        {items.map((n) => (
          <li key={n.href}>
            <Link href={n.href} className="text-ink-2 hover:text-ink">
              {n.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
