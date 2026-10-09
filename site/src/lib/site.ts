import type { Metadata } from "next";

/** The product itself. Every "Try yourself" goes here. */
export const APP_URL = "https://app.diablo.pnoia.dev";

/** Where this site lives. Canonical URLs, the sitemap and shared images are built on it. */
export const SITE_URL = "https://diablo.pnoia.dev";

export const SITE = {
  name: "Diablo",
  company: "Diablo AI",
  tagline: "AI that evolves AI.",
  description:
    "Diablo AI shows companies what is actually happening inside their AI systems: which change moved a score, and how sure they can be.",
} as const;

/**
 * The share card, drawn by app/opengraph-image.tsx (and served again as
 * app/twitter-image.tsx). The file convention only reaches the segment it
 * sits in, so every page names the image itself.
 */
export const SHARE_IMAGE = {
  width: 1200,
  height: 630,
  alt: `${SITE.company}: ${SITE.tagline}`,
  type: "image/png",
} as const;

/** Named for what is behind them. The mark is the way home. */
export const NAV = [
  { href: "/about", label: "About" },
  { href: "/team", label: "Team" },
  { href: "/pricing", label: "Pricing" },
] as const;

/**
 * A page's title, description, canonical URL and share card. Open Graph and
 * Twitter fields are replaced, not merged, by a page that sets them, so every
 * page sets them all here, the share image included.
 */
export function pageMetadata({ path, title, description }: { path: string; title?: string; description: string }): Metadata {
  const full = title ? `${title} · ${SITE.company}` : `${SITE.company} — ${SITE.tagline}`;
  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE.company,
      locale: "en_US",
      url: path,
      title: full,
      description,
      images: [{ url: "/opengraph-image", ...SHARE_IMAGE }],
    },
    twitter: { card: "summary_large_image", title: full, description, images: [{ url: "/twitter-image", ...SHARE_IMAGE }] },
  };
}
