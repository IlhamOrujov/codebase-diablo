"use client";

import { useEffect, useRef } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { FLICK, INSTANT, UI, soft, tick, usePan } from "@/lib/motion";

const TRACK = 52;
const THUMB = 28;
const PAD = 2;
const STRETCH = 6;
const TRAVEL = TRACK - THUMB - PAD * 2;

/**
 * An iOS-style switch. Tap it, or drag the thumb. The thumb widens the
 * moment it is pressed, follows the finger, resists past either end, and on
 * release the direction of the flick decides, not where it happened to stop.
 */
export function BillingSwitch({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  const reduce = useReducedMotion();
  const x = useMotionValue(on ? TRAVEL : 0);
  const stretch = useMotionValue(0);
  const width = useTransform(stretch, [0, 1], [THUMB, THUMB + STRETCH]);
  const start = useRef(0);
  const dragging = useRef(false);
  const handled = useRef(false);
  /** The switch changed itself and is already animating with the gesture's velocity. */
  const internal = useRef(false);

  // Follow the value when it changes from outside (the labels, the keyboard).
  useEffect(() => {
    if (internal.current) {
      internal.current = false;
      return;
    }
    if (dragging.current) return;
    animate(x, on ? TRAVEL : 0, reduce ? INSTANT : UI);
  }, [on, reduce, x]);

  const settle = (next: boolean, velocity = 0) => {
    handled.current = true;
    animate(stretch, 0, reduce ? INSTANT : UI);
    animate(x, next ? TRAVEL : 0, reduce ? INSTANT : { ...FLICK, velocity });
    if (next !== on) {
      tick();
      internal.current = true;
      onChange(next);
    }
  };

  const onPointerDown = usePan({
    axis: "x",
    threshold: 3,
    onDown: () => {
      // The thumb widens toward the middle, so its left edge moves in on the right-hand side.
      x.stop();
      start.current = Math.min(x.get(), TRAVEL - STRETCH);
      animate(x, start.current, reduce ? INSTANT : UI);
      animate(stretch, 1, reduce ? INSTANT : UI);
    },
    onStart: () => {
      dragging.current = true;
    },
    onMove: ({ dx }) => {
      // While pressed the thumb is wider, so it travels a little less.
      x.set(soft(start.current + dx, 0, TRAVEL - STRETCH, 14));
    },
    onEnd: ({ vx }) => {
      dragging.current = false;
      const next = Math.abs(vx) > 150 ? vx > 0 : x.get() > (TRAVEL - STRETCH) / 2;
      settle(next, vx);
    },
    onTap: () => settle(!on),
    onUp: () => {
      // A gesture that turned into a page scroll: put the thumb back.
      if (handled.current || dragging.current) {
        handled.current = false;
        return;
      }
      animate(stretch, 0, reduce ? INSTANT : UI);
      animate(x, on ? TRAVEL : 0, reduce ? INSTANT : UI);
    },
  });

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Bill yearly"
      onPointerDown={onPointerDown}
      // Keyboard activation only; pointer taps are handled above.
      onClick={(e) => {
        if (e.detail === 0) onChange(!on);
      }}
      style={{ width: TRACK, height: THUMB + PAD * 2, touchAction: "pan-y" }}
      className={`relative shrink-0 rounded-full transition-colors duration-200 ${on ? "bg-accent" : "bg-line-strong"}`}
    >
      <motion.span
        aria-hidden
        className="absolute rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.18),0_0_0_0.5px_rgb(0_0_0/0.04)]"
        style={{ left: PAD, top: PAD, height: THUMB, width, x }}
      />
    </button>
  );
}
