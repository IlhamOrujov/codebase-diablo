import { Activity, Database, House, Microscope, Settings, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

/**
 * Sidebar navigation, following the brand spec (§6): a short primary list,
 * a quieter secondary list, then the investigations themselves. Navigation is
 * an open decision; keep it in this one place.
 */
export const HOME: NavItem = { href: "/home", label: "Home", icon: House };
export const INVESTIGATIONS: NavItem = { href: "/investigations", label: "Investigations", icon: Microscope };
/** A real model run end to end (src/lib/live). */
export const LIVE: NavItem = { href: "/live", label: "Live investigation", icon: Activity };

export const PRIMARY: NavItem[] = [
  HOME,
  INVESTIGATIONS,
];

export const SECONDARY: NavItem[] = [
  { href: "/datasets", label: "Datasets", icon: Database },
  { href: "/settings", label: "Settings", icon: Settings },
];

/** The library pages reachable from the command palette. */
export const LIBRARY: NavItem[] = [SECONDARY[0]];

export const LEGAL = [
  { href: "/legal/terms", label: "Terms of Service", short: "Terms" },
  { href: "/legal/privacy", label: "Privacy Policy", short: "Privacy" },
  { href: "/legal/usage", label: "Usage Policy", short: "Usage policy" },
] as const;

export const PAGE_TITLES: Record<string, string> = {
  "/home": "Home",
  "/investigations": "Investigations",
  "/live": "Live investigation",
  "/systems": "AI systems",
  "/experiments": "Experiments",
  "/datasets": "Datasets",
  "/evidence": "Evidence",
  "/reports": "Reports",
  "/settings": "Settings",
  "/design": "Design system",
};

export const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);
