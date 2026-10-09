"use client";

import { useEffect, useRef } from "react";
import { LiveMark } from "@/components/LiveMark";
import { INTRO_ATTR, INTRO_SEEN_KEY } from "@/lib/intro";
import { SITE } from "@/lib/site";

/**
 * The app's entrance, played as the landing page's loading screen: burgundy,
 * the cream mark revealing itself (the same LiveMark reveal at the same 96 px),
 * the name rising beneath it, then the page. A click or a key skips it.
 */
export function SiteIntro() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (!root.hasAttribute(INTRO_ATTR)) return;
    try {
      sessionStorage.setItem(INTRO_SEEN_KEY, "1");
    } catch {}
    let finished = false;
    const end = () => {
      if (finished) return;
      finished = true;
      ref.current?.classList.add("site-intro-out");
      window.setTimeout(() => root.removeAttribute(INTRO_ATTR), 650);
    };
    const t = window.setTimeout(end, 2600);
    window.addEventListener("pointerdown", end, { once: true });
    window.addEventListener("keydown", end, { once: true });
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("pointerdown", end);
      window.removeEventListener("keydown", end);
    };
  }, []);

  return (
    <div ref={ref} className="site-intro" aria-hidden>
      <div className="site-intro-plum" />
      <div className="site-intro-grain" />
      <div className="site-intro-vignette" />
      <div className="relative flex flex-col items-center">
        <LiveMark size={96} intro="full" track blink />
        <p className="site-intro-name mt-5 text-[0.75rem] font-medium uppercase tracking-[0.22em] text-cream/80">{SITE.company}</p>
      </div>
    </div>
  );
}
