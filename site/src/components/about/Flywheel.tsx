"use client";

import { useEffect, useRef } from "react";
import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { LiveMark } from "@/components/LiveMark";
import { COAST, Tracker, usePan } from "@/lib/motion";

const TURNS = ["Investigates AI", "Gains experience", "Improves itself", "Investigates better"];
const r3 = (x: number) => Math.round(x * 1000) / 1000;

/**
 * Diablo's flywheel, as a real one: spin it and it coasts on the same
 * deceleration curve as a scroll view, then stops on its own. Grab it while
 * it spins and it stops under your hand. It gives one small turn when it
 * first comes into view, so you can tell it moves.
 */
export function Flywheel() {
  const reduce = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const seen = useInView(box, { once: true, margin: "0px 0px -25% 0px" });
  const rot = useMotionValue(0);
  const upright = useTransform(rot, (v) => -v);
  const g = useRef({ last: 0, tracker: new Tracker() });

  useEffect(() => {
    if (!seen || reduce) return;
    animate(rot, rot.get(), { ...COAST, velocity: 220 });
  }, [seen, reduce, rot]);

  const angleOf = (x: number, y: number) => {
    const r = box.current!.getBoundingClientRect();
    return (Math.atan2(y - (r.top + r.height / 2), x - (r.left + r.width / 2)) * 180) / Math.PI;
  };

  const onPointerDown = usePan({
    axis: (e) => (e.pointerType === "touch" ? "x" : "free"),
    threshold: 3,
    onDown: (e) => {
      rot.stop();
      g.current.last = angleOf(e.clientX, e.clientY);
      g.current.tracker.reset();
      g.current.tracker.add(rot.get(), 0);
    },
    onMove: ({ x, y }) => {
      const a = angleOf(x, y);
      let d = a - g.current.last;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      g.current.last = a;
      rot.set(rot.get() + d);
      g.current.tracker.add(rot.get(), 0);
    },
    onEnd: () => {
      if (reduce) return;
      const v = g.current.tracker.velocity().vx;
      animate(rot, rot.get(), { ...COAST, velocity: v });
    },
  });

  return (
    <div
      ref={box}
      onPointerDown={onPointerDown}
      style={{ touchAction: "pan-y" }}
      className="relative mx-auto aspect-square w-full max-w-[28rem] cursor-grab select-none active:cursor-grabbing"
      aria-hidden
    >
      <motion.div className="absolute inset-0" style={{ rotate: rot }}>
        <svg viewBox="-110 -110 220 220" className="size-full overflow-visible">
          <defs>
            <marker id="fw-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0 0 10 5 0 10Z" fill="var(--ink-3)" />
            </marker>
          </defs>
          {TURNS.map((_, i) => {
            const R = 75;
            const a0 = (i / TURNS.length) * Math.PI * 2 - Math.PI / 2 + 0.42;
            const a1 = ((i + 1) / TURNS.length) * Math.PI * 2 - Math.PI / 2 - 0.42;
            return (
              <path
                key={i}
                d={`M ${r3(Math.cos(a0) * R)} ${r3(Math.sin(a0) * R)} A ${R} ${R} 0 0 1 ${r3(Math.cos(a1) * R)} ${r3(Math.sin(a1) * R)}`}
                fill="none"
                stroke="var(--ink-3)"
                strokeWidth="0.8"
                markerEnd="url(#fw-arrow)"
              />
            );
          })}
        </svg>
        {TURNS.map((t, i) => {
          const a = (i / TURNS.length) * Math.PI * 2 - Math.PI / 2;
          const k = (75 / 220) * 100;
          return (
            <div key={t} className="absolute" style={{ left: `${r3(50 + Math.cos(a) * k)}%`, top: `${r3(50 + Math.sin(a) * k)}%` }}>
              <motion.span
                style={{ rotate: upright, x: "-50%", y: "-50%" }}
                // On phones a label wraps onto two lines, so it never reaches the edge of the screen or the hub.
                className="t-caption absolute left-0 top-0 w-max max-w-[6.5rem] text-balance rounded-full border bg-surface px-3 py-1.5 text-center font-semibold shadow-2 sm:max-w-none sm:whitespace-nowrap"
              >
                {t}
              </motion.span>
            </div>
          );
        })}
      </motion.div>
      <div className="absolute inset-[37%] grid place-items-center rounded-full bg-burgundy text-cream shadow-3">
        <LiveMark size={52} track blink />
      </div>
    </div>
  );
}
