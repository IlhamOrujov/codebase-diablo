"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutGroup, motion } from "motion/react";
import { Mark } from "@/components/Mark";
import { MenuSheet } from "@/components/MenuSheet";
import { TryButton } from "@/components/TryButton";
import { UI } from "@/lib/motion";
import { NAV, SITE } from "@/lib/site";

/**
 * A translucent bar that content scrolls beneath. No hard divider: once
 * something is underneath, a short blurred edge fades it out instead.
 */
export function SiteHeader() {
  const path = usePathname();
  const [under, setUnder] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const onScroll = () => setUnder(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const current = NAV.find((n) => path.startsWith(n.href))?.href ?? null;
  const lit = hover ?? current;

  return (
    <header className="material sticky top-0 z-40">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="press flex items-center gap-2.5 rounded-xl" aria-label={`${SITE.company}, home`}>
          <span className="grid size-8 place-items-center rounded-[0.6rem] bg-burgundy text-cream">
            <Mark size={20} />
          </span>
          <span className="text-[1.0625rem] font-semibold tracking-[-0.02em]">{SITE.name}</span>
        </Link>

        <nav aria-label="Main" className="hidden md:block">
          <LayoutGroup id="nav">
            <ul className="flex items-center gap-1" onPointerLeave={() => setHover(null)}>
              {NAV.map((n) => {
                const active = current === n.href;
                return (
                  <li key={n.href}>
                    <Link
                      href={n.href}
                      aria-current={active ? "page" : undefined}
                      onPointerEnter={() => setHover(n.href)}
                      onFocus={() => setHover(n.href)}
                      onBlur={() => setHover(null)}
                      className={`press relative block rounded-full px-4 py-2 text-[0.9375rem] font-medium transition-colors ${
                        active ? "text-ink" : "text-ink-2 hover:text-ink"
                      }`}
                    >
                      {lit === n.href && (
                        <motion.span layoutId="nav-lit" transition={UI} className="absolute inset-0 -z-10 rounded-full bg-accent-tint-2" />
                      )}
                      {n.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </LayoutGroup>
        </nav>

        <div className="flex items-center gap-2">
          <TryButton size="sm" />
          <button
            type="button"
            onClick={() => setMenu(true)}
            aria-label="Open menu"
            aria-haspopup="dialog"
            aria-expanded={menu}
            className="press grid size-9 place-items-center rounded-full text-ink hover:bg-accent-tint md:hidden"
          >
            <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
              <path d="M3.5 7h13M3.5 13h13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Scroll edge: only when content is actually underneath. */}
      <div
        aria-hidden
        className={`scroll-edge pointer-events-none absolute inset-x-0 top-full h-5 transition-opacity duration-300 ${under ? "opacity-100" : "opacity-0"}`}
        style={{
          background: "linear-gradient(var(--material), transparent)",
          WebkitBackdropFilter: "blur(6px)",
          backdropFilter: "blur(6px)",
          maskImage: "linear-gradient(black, transparent)",
          WebkitMaskImage: "linear-gradient(black, transparent)",
        }}
      />

      <MenuSheet open={menu} onOpenChange={setMenu} />
    </header>
  );
}
