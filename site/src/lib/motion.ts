"use client";

import { useLayoutEffect, useRef } from "react";
import type { Transition } from "motion/react";

/*
 * Motion, the Apple way (Designing Fluid Interfaces, WWDC 2018):
 * springs described by damping ratio and response, momentum projected
 * with the scroll-view deceleration curve, soft boundaries, and gestures
 * that track the pointer 1:1 and hand their velocity to the animation.
 */

/** A spring in Apple's terms. Damping 1 settles without overshoot; response is how quickly it gets there, in seconds. */
export function spring(damping = 1, response = 0.4, velocity?: number): Transition {
  return { type: "spring", bounce: Math.max(0, 1 - damping), visualDuration: response, ...(velocity === undefined ? {} : { velocity }) };
}

/** Repositioning: no overshoot. */
export const MOVE = spring(1, 0.4);
/** Everyday UI: quick, no overshoot. */
export const UI = spring(1, 0.3);
/** After a flick or a throw the motion may overshoot a little, because the gesture carried momentum. */
export const FLICK = spring(0.8, 0.4);
export const SHEET = spring(0.8, 0.3);
export const ROTATE = spring(0.8, 0.4);
/** Reduced motion: no travel, just settle. */
export const INSTANT: Transition = { duration: 0 };

/** Where a flick comes to rest: the scroll-view deceleration curve (rate per millisecond). */
export function project(velocity: number, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** The same deceleration as an inertia animation, for things that coast freely (the flywheel). */
export const COAST = { type: "inertia" as const, power: project(1), timeConstant: -1 / Math.log(0.998) };

/** Past a boundary, follow less and less: real things slow before they stop. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/** Clamp with a rubber band outside [min, max]. */
export function soft(value: number, min: number, max: number, dimension: number) {
  if (value < min) return min - rubberband(min - value, dimension);
  if (value > max) return max + rubberband(value - max, dimension);
  return value;
}

export function nearest(points: readonly number[], x: number) {
  return points.reduce((best, p) => (Math.abs(p - x) < Math.abs(best - x) ? p : best), points[0]);
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * The reduced-motion setting, read where it is used (an effect or a handler).
 * Never branch the rendered markup on it: the server cannot know it, so the
 * markup must be the same either way and CSS or an effect does the rest.
 */
export function reducedMotionNow() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** True when any part of the element is inside the viewport right now. */
export function onScreen(el: Element) {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight;
}

/** A light tap on devices that have one, only for meaningful moments (a snap, a commit). */
export function tick() {
  try {
    navigator.vibrate?.(6);
  } catch {
    // No haptics here.
  }
}

/* ── Velocity: a short history of samples, not just the last point. ── */

type Sample = { t: number; x: number; y: number };

export class Tracker {
  private samples: Sample[] = [];
  add(x: number, y: number, t = performance.now()) {
    this.samples.push({ t, x, y });
    while (this.samples.length > 2 && t - this.samples[0].t > 100) this.samples.shift();
  }
  reset() {
    this.samples = [];
  }
  /** Pixels (or whatever unit was fed in) per second. */
  velocity() {
    const s = this.samples;
    if (s.length < 2) return { vx: 0, vy: 0 };
    const a = s[0];
    const b = s[s.length - 1];
    const dt = (b.t - a.t) / 1000;
    if (dt <= 0) return { vx: 0, vy: 0 };
    // A finger that stopped before lifting carries no velocity.
    if (performance.now() - b.t > 80) return { vx: 0, vy: 0 };
    return { vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt };
  }
}

/* ── Pan: pointer capture, 1:1 tracking, hysteresis, velocity at release. ── */

type Axis = "x" | "y" | "free";

export type PanHandlers = {
  /** "x" or "y" lock to an axis after the threshold and let the other axis scroll the page. May depend on the pointer type. */
  axis?: Axis | ((e: PointerEvent) => Axis);
  /** Movement needed before a pan begins (a tap below it stays a tap). */
  threshold?: number;
  /** On pointer-down: give feedback now, and stop anything in flight. */
  onDown?: (e: PointerEvent) => void;
  onStart?: (e: PointerEvent) => void;
  onMove: (d: { dx: number; dy: number; x: number; y: number }, e: PointerEvent) => void;
  onEnd: (v: { vx: number; vy: number; dx: number; dy: number }, e: PointerEvent) => void;
  /** Released without panning. */
  onTap?: (e: PointerEvent) => void;
  /** Released or cancelled, panned or not. */
  onUp?: () => void;
};

export function usePan(handlers: PanHandlers) {
  const h = useRef(handlers);
  useLayoutEffect(() => {
    h.current = handlers;
  });

  return (down: React.PointerEvent<Element>) => {
    if (down.button !== 0) return;
    const el = down.currentTarget as Element;
    const id = down.pointerId;
    const sx = down.clientX;
    const sy = down.clientY;
    const tracker = new Tracker();
    tracker.add(sx, sy);
    const { axis: axisOpt = "free", threshold = 6 } = h.current;
    const axis = typeof axisOpt === "function" ? axisOpt(down.nativeEvent) : axisOpt;
    let panning = false;
    let dead = false;

    h.current.onDown?.(down.nativeEvent);

    const move = (e: PointerEvent) => {
      if (e.pointerId !== id || dead) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      tracker.add(e.clientX, e.clientY);
      if (!panning) {
        const ax = Math.abs(dx);
        const ay = Math.abs(dy);
        if (Math.max(ax, ay) < threshold) return;
        // The page owns the other axis: let it scroll.
        if ((axis === "x" && ay > ax) || (axis === "y" && ax > ay)) {
          dead = true;
          finish();
          return;
        }
        panning = true;
        try {
          el.setPointerCapture(id);
        } catch {}
        h.current.onStart?.(e);
      }
      h.current.onMove({ dx, dy, x: e.clientX, y: e.clientY }, e);
    };

    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      const cancelled = e.type === "pointercancel";
      if (panning) {
        const v = cancelled ? { vx: 0, vy: 0 } : tracker.velocity();
        h.current.onEnd({ ...v, dx: e.clientX - sx, dy: e.clientY - sy }, e);
      } else if (!cancelled && !dead) {
        h.current.onTap?.(e);
      }
      finish();
    };

    function finish() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      h.current.onUp?.();
    }

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
}
