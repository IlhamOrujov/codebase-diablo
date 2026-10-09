import type { MetadataRoute } from "next";
import { NAV, SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    ...NAV.map((n) => ({ url: `${SITE_URL}${n.href}`, changeFrequency: "monthly" as const, priority: 0.7 })),
  ];
}
