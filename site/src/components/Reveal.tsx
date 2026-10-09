"use client";

import { useLayoutEffect, useRef } from "react";
import { animate } from "motion/react";
import { onScreen, reducedMotionNow, spring } from "@/lib/motion";

/**
 * Settles into place the first time it scrolls into view.
 *
 * The server HTML is always visible. Only blocks that are still below the
 * fold when the page wakes up are lowered and faded out (before the browser
 * paints again), so the first screen never flashes, and with no JavaScript or
 * with reduced motion everything is simply there, without movement.
 */
export function Reveal({
  children,
  delay = 0,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li" | "section";
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reducedMotionNow() || onScreen(el)) return;
    el.style.opacity = "0";
    el.style.transform = "translateY(20px)";
    let shown = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        shown = true;
        animate(el, { opacity: 1, transform: "translateY(0px)" }, { ...spring(1, 0.6), delay }).then(() => {
          // Leave no transform behind: it would make a stacking context for everything inside.
          el.style.opacity = "";
          el.style.transform = "";
        });
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (!shown) {
        el.style.opacity = "";
        el.style.transform = "";
      }
    };
  }, [delay]);

  // "li" and "section" take the same props; the cast only satisfies the ref's element type.
  const Tag = as as "div";
  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}

/** A section's heading block. */
export function SectionHead({
  eyebrow,
  title,
  children,
  className = "",
}: {
  eyebrow?: string;
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Reveal className={`max-w-2xl ${className}`}>
      {eyebrow && <p className="t-overline mb-4 text-accent-text">{eyebrow}</p>}
      <h2 className="t-title text-balance">{title}</h2>
      {children && <p className="t-lead mt-5 text-pretty text-ink-2">{children}</p>}
    </Reveal>
  );
}
