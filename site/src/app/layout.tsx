import type { Metadata, Viewport } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { INTRO_SCRIPT } from "@/lib/intro";
import { SHARE_IMAGE, SITE, SITE_URL } from "@/lib/site";
import "./globals.css";

const TITLE = `${SITE.company} — ${SITE.tagline}`;

/**
 * Defaults. Each page sets its own description, canonical URL and share card
 * (see pageMetadata); the 404 page inherits these, without a canonical URL.
 * The icons and the share image are files in app/: icon.svg, apple-icon.tsx,
 * opengraph-image.tsx and twitter-image.tsx.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: `%s · ${SITE.company}` },
  description: SITE.description,
  applicationName: SITE.company,
  openGraph: {
    type: "website",
    siteName: SITE.company,
    locale: "en_US",
    title: TITLE,
    description: SITE.description,
    images: [{ url: "/opengraph-image", ...SHARE_IMAGE }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: SITE.description, images: [{ url: "/twitter-image", ...SHARE_IMAGE }] },
};

/** Without JavaScript nothing plays, so show the mark finished instead of in its "before" pose. */
const NO_SCRIPT_CSS =
  "[data-part=lens],[data-part=head],[data-part=eye],[data-part=crescent]{transform:none!important}[data-part=crescent]{opacity:1!important}";

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f7f4" },
    { media: "(prefers-color-scheme: dark)", color: "#171315" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* Decides before first paint whether the landing intro plays (see SiteIntro). */}
        <script dangerouslySetInnerHTML={{ __html: INTRO_SCRIPT }} />
        <noscript dangerouslySetInnerHTML={{ __html: `<style>${NO_SCRIPT_CSS}</style>` }} />
      </head>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="t-callout sr-only z-50 rounded-full bg-ink px-4 py-2 font-medium text-bg focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
