"use client";

import { useEffect, useId } from "react";
import { animate, motion, useAnimate, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { MARK_PATHS, MARK_VIEWBOX } from "@/lib/mark-paths";
import { reducedMotionNow } from "@/lib/motion";

const [VX, VY, VW, VH] = MARK_VIEWBOX.split(" ").map(Number);
const FACE = { x: 700, y: 550 };
const REVEAL = [0.22, 1, 0.36, 1] as const;
const IN_OUT = [0.65, 0, 0.35, 1] as const;
/** The mark only blinks while someone is using the page; idle pages stay still. */
const AWAKE_MS = 8000;

let lastActivity = 0;
let activityBound = false;
function bindActivity() {
  if (activityBound || typeof window === "undefined") return;
  activityBound = true;
  const mark = () => {
    lastActivity = Date.now();
  };
  window.addEventListener("pointermove", mark, { passive: true });
  window.addEventListener("keydown", mark, { passive: true });
}

/**
 * The mark, alive. The head is masked so the eyes are real holes and the mark
 * works on any background. Eyes open, follow the pointer and blink; the head
 * and crescent can reveal themselves once. Everything stops under reduced
 * motion (the system setting), leaving the static mark.
 *
 * The markup never depends on that setting (the server cannot know it): a mark
 * with an intro is rendered in its "before" pose, and under reduced motion CSS
 * shows it finished from the first paint, then the effect makes that final.
 */
export function LiveMark({
  size = 20,
  intro = "none",
  track = false,
  blink = false,
  className,
  title,
  onIntroDone,
}: {
  size?: number;
  /** "full" plays the whole reveal, "short" a quick one, "none" is static. */
  intro?: "full" | "short" | "none";
  /** Eyes follow the pointer. */
  track?: boolean;
  /** An occasional blink while the user is active. */
  blink?: boolean;
  className?: string;
  title?: string;
  onIntroDone?: () => void;
}) {
  const uid = useId().replace(/[:«»]/g, "");
  const [scope, animateScope] = useAnimate();
  const reduce = !!useReducedMotion();

  // ── Eyes: pointer tracking ──────────────────────────────────────
  const lookX = useMotionValue(0);
  const lookY = useMotionValue(0);
  const ex = useSpring(lookX, { stiffness: 150, damping: 18, mass: 0.6 });
  const ey = useSpring(lookY, { stiffness: 150, damping: 18, mass: 0.6 });
  const lid = useMotionValue(1);

  useEffect(() => {
    if (!track || reduce) {
      lookX.set(0);
      lookY.set(0);
      return;
    }
    const onMove = (e: PointerEvent) => {
      const el = scope.current as SVGSVGElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (!r.width) return;
      const cx = r.left + ((FACE.x - VX) / VW) * r.width;
      const cy = r.top + ((FACE.y - VY) / VH) * r.height;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const d = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, d / 260);
      lookX.set((dx / d) * 14 * reach);
      lookY.set((dy / d) * 9 * reach);
    };
    const center = () => {
      lookX.set(0);
      lookY.set(0);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", center);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", center);
    };
  }, [track, reduce, lookX, lookY, scope]);

  // ── Eyes: blinking, only while the page is in use ───────────────
  useEffect(() => {
    if (!blink || reduce) return;
    bindActivity();
    let t: ReturnType<typeof setTimeout>;
    let alive = true;
    const loop = () => {
      t = setTimeout(async () => {
        if (!alive) return;
        if (Date.now() - lastActivity < AWAKE_MS && document.visibilityState === "visible") {
          await animate(lid, [1, 0.08, 1], { duration: 0.2, ease: "easeInOut" });
          if (alive && Math.random() < 0.2) await animate(lid, [1, 0.08, 1], { duration: 0.18, ease: "easeInOut" });
        }
        if (alive) loop();
      }, 2600 + Math.random() * 4200);
    };
    loop();
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [blink, reduce, lid]);

  // ── The reveal ──────────────────────────────────────────────────
  useEffect(() => {
    if (intro === "none") {
      onIntroDone?.();
      return;
    }
    if (reducedMotionNow()) {
      // Straight to the finished mark, with no travel.
      const now = { duration: 0 };
      animateScope(`[data-part=lens]`, { scale: 1 }, now);
      animateScope(`[data-part=head]`, { rotate: 0, scale: 1 }, now);
      animateScope(`[data-part=eye]`, { scaleY: 1 }, now);
      animateScope(`[data-part=crescent]`, { opacity: 1, x: 0, y: 0, rotate: 0 }, now);
      onIntroDone?.();
      return;
    }
    const mode = intro;
    const k = mode === "short" ? 0.4 : 1;
    let cancelled = false;
    let finished = false;
    const finish = () => {
      if (finished || cancelled) return;
      finished = true;
      onIntroDone?.();
    };
    // Never trap anyone behind the intro, whatever the browser does.
    const guard = setTimeout(finish, (2.4 * k + 1.6) * 1000);
    (async () => {
      await Promise.all([
        // A small cream fragment appears near the centre…
        animateScope(`[data-part=seed]`, { scale: [0, 1.8, 1], opacity: [0, 1, 1] }, { duration: 0.5 * k, delay: 0.12 * k, ease: REVEAL }),
        // …the head and horn curve into place behind a widening lens…
        animateScope(`[data-part=lens]`, { scale: [0, 1] }, { duration: 1.1 * k, delay: 0.4 * k, ease: REVEAL }),
        animateScope(`[data-part=head]`, { rotate: [-9, 0], scale: [0.9, 1] }, { duration: 1.2 * k, delay: 0.36 * k, ease: REVEAL }),
        animateScope(`[data-part=outline]`, { pathLength: [0, 1], opacity: [0, 0.9, 0] }, { duration: 1.25 * k, delay: 0.28 * k, ease: IN_OUT }),
        animateScope(`[data-part=seed]`, { opacity: 0 }, { duration: 0.3 * k, delay: 0.9 * k }),
        // …the eyes open…
        animateScope(`[data-part=eye]`, { scaleY: [0, 1.15, 1] }, { duration: 0.4 * k, delay: 1.08 * k, ease: [0.16, 1, 0.3, 1] }),
        // …and the crescent separates and settles beneath.
        animateScope(
          `[data-part=crescent]`,
          { opacity: [0, 1], x: [-46, 0], y: [-70, 0], rotate: [-28, 0] },
          { duration: 0.9 * k, delay: 0.95 * k, ease: REVEAL },
        ),
      ]);
      if (!cancelled && mode === "full") {
        await animateScope(scope.current, { scale: [1, 1.012, 1] }, { duration: 0.45, ease: IN_OUT });
      }
      finish();
    })();
    return () => {
      cancelled = true;
      clearTimeout(guard);
    };
    // The reveal runs once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const w = (size * VW) / VH;
  const hidden = intro !== "none";
  const box = { x: VX - 200, y: VY - 200, width: VW + 400, height: VH + 400 };

  return (
    <motion.svg
      ref={scope}
      viewBox={MARK_VIEWBOX}
      width={w}
      height={size}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={className}
      style={{ overflow: "visible" }}
    >
      <defs>
        <radialGradient id={`lens-${uid}`}>
          <stop offset="0.82" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </radialGradient>
        <mask id={`reveal-${uid}`} maskUnits="userSpaceOnUse" {...box}>
          <rect {...box} fill="#000" />
          <circle
            data-part="lens"
            cx={640}
            cy={470}
            r={hidden ? 620 : 900}
            fill={`url(#lens-${uid})`}
            style={{ transformBox: "fill-box", transformOrigin: "center", transform: hidden ? "scale(0)" : undefined }}
          />
        </mask>
        <mask id={`eyes-${uid}`} maskUnits="userSpaceOnUse" {...box}>
          <rect {...box} fill="#fff" />
          <motion.g style={{ x: ex, y: ey }}>
            <motion.g style={{ scaleY: lid, transformBox: "fill-box", originY: 0.5 }}>
              {[MARK_PATHS.eyeL, MARK_PATHS.eyeR].map((d) => (
                <motion.path
                  key={d.slice(0, 12)}
                  data-part="eye"
                  d={d}
                  fill="#000"
                  initial={hidden ? { scaleY: 0 } : false}
                  style={{ transformBox: "fill-box", originX: 0.5, originY: 0.5 }}
                />
              ))}
            </motion.g>
          </motion.g>
        </mask>
      </defs>

      {hidden && (
        <circle
          data-part="seed"
          cx={FACE.x - 40}
          cy={FACE.y}
          r={10}
          fill="currentColor"
          opacity={0}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        />
      )}

      <motion.g data-part="head" style={{ transformBox: "view-box", originX: "640px", originY: "520px" }}>
        <g mask={hidden ? `url(#reveal-${uid})` : undefined}>
          <path d={MARK_PATHS.head} fill="currentColor" mask={`url(#eyes-${uid})`} />
        </g>
        {hidden && (
          <motion.path
            data-part="outline"
            d={MARK_PATHS.head}
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            initial={{ pathLength: 0, opacity: 0 }}
          />
        )}
      </motion.g>

      <motion.path
        data-part="crescent"
        d={MARK_PATHS.crescent}
        fill="currentColor"
        initial={hidden ? { opacity: 0 } : false}
        style={{ transformBox: "fill-box", originX: 0.2, originY: 0.1 }}
      />
    </motion.svg>
  );
}
