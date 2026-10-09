"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useInView, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from "motion/react";
import { SectionHead } from "@/components/Reveal";
import { INSTANT, MOVE, ROTATE, Tracker, UI, project, tick, usePan } from "@/lib/motion";

const STEPS = [
  { name: "Question", line: "You ask what you want to understand about your AI." },
  { name: "Hypotheses", line: "Diablo lists the possible causes, including competing ones." },
  { name: "Experiment", line: "It designs a controlled test that can tell them apart." },
  { name: "Evidence", line: "The system runs the experiment and records every result." },
  { name: "Analysis", line: "Statistics are computed by code, never written by the model." },
  { name: "Conclusion", line: "A claim is only as strong as the evidence behind it." },
  { name: "Knowledge", line: "The conclusion links to its evidence, down to the raw outputs." },
  { name: "Improvement", line: "The next experiment follows from the evidence. Then the loop runs again." },
];
const N = STEPS.length;
const STEP = 360 / N;
const mod = (a: number, n: number) => ((a % n) + n) % n;
/** Server and browser disagree on the last digit of sin/cos; round so hydration matches. */
const r3 = (x: number) => Math.round(x * 1000) / 1000;
/** The step that sits under the marker at the top for a given rotation. */
const indexAt = (rot: number) => mod(Math.round(-rot / STEP), N);

export function Loop() {
  return (
    <section id="loop" className="scroll-mt-16 border-t">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[0.85fr_1.15fr]">
        <SectionHead eyebrow="How it works" title="One loop, from a question to a better AI.">
          Diablo doesn’t jump to a fix. It works the way a careful researcher would, and every step leaves a record. Turn
          the dial.
        </SectionHead>
        <Dial />
      </div>
    </section>
  );
}

function Dial() {
  const reduce = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const inView = useInView(box, { margin: "-20% 0px -20% 0px" });
  const rot = useMotionValue(0);
  const upright = useTransform(rot, (v) => -v);
  const [active, setActive] = useState(0);
  const [touched, setTouched] = useState(false);
  /** The step the dial is turning to, so quick key presses add up even mid-turn. */
  const aim = useRef(0);
  const drag = useRef({ start: 0, last: 0, acc: 0, mode: "angle" as "angle" | "swipe", radius: 1, tracker: new Tracker() });

  useMotionValueEvent(rot, "change", (v) => {
    const i = indexAt(v);
    setActive((a) => (a === i ? a : i));
  });

  /** Rotate to a step by the shortest way round. No momentum, so no overshoot. */
  function goTo(i: number) {
    aim.current = mod(i, N);
    const base = -i * STEP;
    const cur = rot.get();
    const target = base + 360 * Math.round((cur - base) / 360);
    animate(rot, target, reduce ? INSTANT : MOVE);
  }

  // Until someone touches it, the dial turns itself now and then, only while visible.
  useEffect(() => {
    if (touched || reduce || !inView) return;
    const t = setInterval(() => goTo(indexAt(rot.get()) + 1), 3400);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [touched, reduce, inView]);

  const angleOf = (x: number, y: number) => {
    const r = box.current!.getBoundingClientRect();
    return (Math.atan2(y - (r.top + r.height / 2), x - (r.left + r.width / 2)) * 180) / Math.PI;
  };

  const onPointerDown = usePan({
    // A mouse turns the dial by its angle. A finger swipes across it, so a vertical swipe still scrolls the page.
    axis: (e) => (e.pointerType === "touch" ? "x" : "free"),
    threshold: 4,
    onDown: (e) => {
      setTouched(true);
      rot.stop();
      const d = drag.current;
      d.start = rot.get();
      d.acc = 0;
      d.mode = e.pointerType === "touch" ? "swipe" : "angle";
      d.last = angleOf(e.clientX, e.clientY);
      d.radius = (box.current!.getBoundingClientRect().width * 0.4) || 1;
      d.tracker.reset();
      d.tracker.add(d.start, 0);
    },
    onMove: ({ dx, x, y }) => {
      const d = drag.current;
      if (d.mode === "angle") {
        const a = angleOf(x, y);
        let delta = a - d.last;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        d.last = a;
        d.acc += delta;
      } else {
        // Along the top of the ring, a sideways swipe moves the rim under the finger.
        d.acc = (dx / d.radius) * (180 / Math.PI);
      }
      const v = d.start + d.acc;
      rot.set(v);
      d.tracker.add(v, 0);
    },
    onEnd: () => {
      const before = indexAt(rot.get());
      const v = drag.current.tracker.velocity().vx;
      const rest = rot.get() + project(v, 0.99);
      const target = Math.round(rest / STEP) * STEP;
      aim.current = indexAt(target);
      animate(rot, target, reduce ? INSTANT : { ...ROTATE, velocity: v });
      if (indexAt(target) !== before || Math.abs(v) > 60) tick();
    },
    onTap: (e) => {
      const hit = (e.target as Element).closest<HTMLElement>("[data-step]");
      if (hit) goTo(Number(hit.dataset.step));
    },
  });

  return (
    // On phones the dial sits a little in from the edges, so the step labels on its rim never leave the screen.
    <div className="mx-auto w-full max-w-[34rem] px-4 sm:px-0">
      <div
        ref={box}
        role="slider"
        tabIndex={0}
        aria-label="Investigation loop"
        aria-valuemin={1}
        aria-valuemax={N}
        aria-valuenow={active + 1}
        aria-valuetext={`${STEPS[active].name}: ${STEPS[active].line}`}
        onPointerDown={onPointerDown}
        // Someone reading it with the keyboard or a screen reader should not have it turn under them.
        onFocus={() => setTouched(true)}
        onKeyDown={(e) => {
          const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
          if (step) {
            e.preventDefault();
            setTouched(true);
            // Mid-turn, count from where it is headed; the new spring starts from where it is.
            goTo((rot.isAnimating() ? aim.current : active) + step);
          } else if (e.key === "Home" || e.key === "End") {
            e.preventDefault();
            setTouched(true);
            goTo(e.key === "Home" ? 0 : N - 1);
          }
        }}
        style={{ touchAction: "pan-y" }}
        className="relative aspect-square w-full cursor-grab select-none rounded-full active:cursor-grabbing"
      >
        {/* The reading marker stays put at the top; the dial turns beneath it. */}
        <div aria-hidden className="absolute left-1/2 top-[3.5%] z-10 -translate-x-1/2">
          <svg viewBox="0 0 16 10" className="h-2.5 w-4 text-accent-text">
            <path d="M8 10 0 0h16Z" fill="currentColor" />
          </svg>
        </div>

        <motion.div aria-hidden className="absolute inset-0" style={{ rotate: rot }}>
          <svg viewBox="-100 -100 200 200" className="size-full overflow-visible">
            <circle r="80" fill="none" stroke="var(--line-strong)" strokeWidth="0.6" />
            {Array.from({ length: N * 4 }, (_, i) => {
              const a = (i / (N * 4)) * Math.PI * 2;
              const major = i % 4 === 0;
              const r0 = major ? 86 : 87.5;
              return (
                <line
                  key={i}
                  x1={r3(Math.sin(a) * r0)}
                  y1={r3(-Math.cos(a) * r0)}
                  x2={r3(Math.sin(a) * 90)}
                  y2={r3(-Math.cos(a) * 90)}
                  stroke={major ? "var(--ink-3)" : "var(--line-strong)"}
                  strokeWidth={major ? 0.7 : 0.5}
                />
              );
            })}
          </svg>
          {STEPS.map((s, i) => {
            const a = (i * STEP * Math.PI) / 180;
            const on = i === active;
            return (
              <div key={s.name} className="absolute" style={{ left: `${r3(50 + Math.sin(a) * 40)}%`, top: `${r3(50 - Math.cos(a) * 40)}%` }}>
                <motion.span
                  data-step={i}
                  style={{ rotate: upright, x: "-50%", y: "-50%" }}
                  className={`t-caption absolute left-0 top-0 cursor-pointer whitespace-nowrap rounded-full border px-2.5 py-1 font-semibold transition-colors duration-200 ${
                    on ? "border-transparent bg-accent text-accent-ink shadow-2" : "bg-surface text-ink-2 hover:text-ink"
                  }`}
                >
                  {s.name}
                </motion.span>
              </div>
            );
          })}
        </motion.div>

        <div className="pointer-events-none absolute inset-[27%] grid place-items-center text-center">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={active}
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, filter: "blur(4px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.02, filter: "blur(4px)" }}
              transition={reduce ? { duration: 0.15 } : UI}
            >
              <p className="t-caption font-mono text-ink-3">
                {String(active + 1).padStart(2, "0")} / {String(N).padStart(2, "0")}
              </p>
              <p className="mt-1.5 text-[clamp(1.25rem,3.4vw,1.875rem)] font-semibold leading-tight tracking-[-0.025em]">
                {STEPS[active].name}
              </p>
              <p className="t-callout mx-auto mt-2 hidden max-w-[15rem] text-ink-2 sm:block">{STEPS[active].line}</p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      {/* All the lines share one cell, so this is always as tall as the longest and the page never jumps as the dial turns. */}
      <div className="t-callout mt-6 grid text-center text-ink-2 sm:hidden">
        {STEPS.map((s, i) => (
          <p key={s.name} aria-hidden={i !== active} className={`col-start-1 row-start-1 ${i === active ? "" : "invisible"}`}>
            {s.line}
          </p>
        ))}
      </div>
      <p className="t-caption mt-3 text-center text-ink-3">Drag to turn · arrow keys work too</p>
    </div>
  );
}
