"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { TryButton } from "@/components/TryButton";
import { INSTANT, SHEET, UI, project, rubberband, spring, tick, usePan } from "@/lib/motion";
import { NAV } from "@/lib/site";

/**
 * The phone menu as a bottom sheet. It enters from the bottom and leaves the
 * same way; it follows the finger 1:1, resists being pulled up, and on release
 * projects the flick to decide whether to close. It can be grabbed again while
 * it is still closing. A scrim dims the page because this is a modal task:
 * while it is open the page behind is inert, and Tab cycles inside the sheet.
 */
export function MenuSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const reduce = useReducedMotion();
  const path = usePathname();
  const layer = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const sheetWantsOpen = useRef(false);
  const startY = useRef(0);
  const [mounted, setMounted] = useState(false);
  const y = useMotionValue(0);
  const shown = useMotionValue(0);
  const scrim = useTransform(shown, [0, 1], [0, 1]);

  // Mount on open; unmount only after the closing motion has finished.
  if (open && !mounted) setMounted(true);

  const height = () => sheet.current?.offsetHeight ?? 480;

  const close = (velocity = 0) => {
    const h = height();
    animate(shown, 0, reduce ? { duration: 0.2 } : UI);
    const done = () => {
      if (!sheetWantsOpen.current) setMounted(false);
    };
    if (reduce) {
      setTimeout(done, 200);
    } else {
      animate(y, h, { ...spring(1, 0.3, velocity), onComplete: done });
    }
    sheetWantsOpen.current = false;
    onOpenChange(false);
  };

  const settleOpen = (velocity = 0) => {
    sheetWantsOpen.current = true;
    animate(shown, 1, reduce ? { duration: 0.2 } : UI);
    animate(y, 0, reduce ? INSTANT : { ...SHEET, velocity });
  };

  // Enter from below on open.
  useLayoutEffect(() => {
    if (!open || !mounted) return;
    if (!reduce && !sheetWantsOpen.current) y.set(height());
    settleOpen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mounted]);

  // Escape closes; the page behind does not scroll and cannot be reached; focus moves in, stays in, and goes back out.
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    const behind = [...document.body.children].filter(
      (el) => el !== layer.current && !el.hasAttribute("inert") && !["SCRIPT", "NEXT-ROUTE-ANNOUNCER"].includes(el.tagName),
    );
    for (const el of behind) el.setAttribute("inert", "");
    const stops = () => [...(sheet.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? [])];
    stops()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const all = stops();
      if (!all.length) return;
      const first = all[0];
      const last = all[all.length - 1];
      const at = document.activeElement;
      const inside = !!at && !!sheet.current?.contains(at);
      if (e.shiftKey && (at === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (at === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      for (const el of behind) el.removeAttribute("inert");
      root.style.overflow = overflow;
      prev?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onPointerDown = usePan({
    axis: "y",
    threshold: 8,
    onDown: () => {
      // Grabbing a sheet that is on its way out catches it.
      y.stop();
    },
    onMove: ({ dy }) => {
      const base = startY.current;
      const next = base + dy;
      // Downward follows the finger; upward resists.
      y.set(next >= 0 ? next : -rubberband(-next, height()));
    },
    onStart: () => {
      startY.current = y.get();
      if (!open) onOpenChange(true);
    },
    onEnd: ({ vy }) => {
      const h = height();
      const rest = y.get() + project(vy);
      if (rest > h * 0.45) {
        tick();
        close(vy);
      } else {
        settleOpen(vy);
      }
    },
  });

  if (!mounted) return null;

  return createPortal(
    <div ref={layer} className="fixed inset-0 z-50 md:hidden" role="presentation">
      <motion.div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "var(--scrim)", opacity: scrim }}
        onClick={() => close()}
      />
      <motion.div
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        onPointerDown={onPointerDown}
        style={{ y: reduce ? 0 : y, opacity: reduce ? shown : 1, touchAction: "pan-x" }}
        className="material-thick absolute inset-x-0 bottom-0 rounded-t-[1.75rem] border-t border-white/40 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-3 dark:border-white/10"
      >
        <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-ink/20" aria-hidden />
        <nav aria-label="Main">
          <ul>
            <li>
              <Link
                href="/"
                onClick={() => close()}
                aria-current={path === "/" ? "page" : undefined}
                className="press flex items-center justify-between rounded-2xl px-3 py-3.5 text-[1.375rem] font-semibold tracking-[-0.02em]"
              >
                Overview
                {path === "/" && <span className="size-2 rounded-full bg-accent" />}
              </Link>
            </li>
            {NAV.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  onClick={() => close()}
                  aria-current={path.startsWith(n.href) ? "page" : undefined}
                  className="press flex items-center justify-between rounded-2xl px-3 py-3.5 text-[1.375rem] font-semibold tracking-[-0.02em]"
                >
                  {n.label}
                  {path.startsWith(n.href) && <span className="size-2 rounded-full bg-accent" />}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-5 flex items-center gap-3">
          <TryButton size="lg" className="flex-1 justify-center" />
          <button
            type="button"
            onClick={() => close()}
            className="press h-[3.25rem] rounded-full border border-line-strong px-5 text-[1.0625rem] font-semibold"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}
