"use client";

import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform, useVelocity } from "motion/react";
import { LiveMark } from "@/components/LiveMark";
import { TryButton } from "@/components/TryButton";
import { FLICK, INSTANT, UI, reducedMotionNow, soft, usePan } from "@/lib/motion";

const QUESTIONS = [
  "Why did it get worse?",
  "What is it bad at?",
  "What changed?",
  "Why does it behave this way?",
  "How can we make it better?",
];

const delay = (s: number) => ({ "--d": `${s}s` }) as React.CSSProperties;

export function Hero() {
  return (
    <section className="relative">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-14 sm:px-6 md:pt-24 lg:grid-cols-[1.15fr_0.85fr] lg:pb-28">
        <div>
          <p className="rise t-overline text-accent-text">AI evolution</p>
          <h1 className="rise t-hero mt-5 text-balance" style={delay(0.06)}>
            AI that evolves <span className="text-accent-text">AI.</span>
          </h1>
          <p className="rise t-lead mt-7 max-w-xl text-pretty text-ink-2" style={delay(0.14)}>
            Diablo AI shows companies what is actually happening inside their AI systems: not just that a score moved, but
            which change moved it, and how sure they can be.
          </p>
          <div className="rise mt-9 flex flex-wrap items-center gap-3" style={delay(0.22)}>
            <TryButton size="lg" />
            <a
              href="#loop"
              className="press inline-flex h-[3.25rem] items-center rounded-full border border-line-strong px-6 text-[1.0625rem] font-semibold transition-colors hover:bg-accent-tint"
            >
              How it works
            </a>
          </div>
          <div className="rise mt-12 max-w-md" style={delay(0.3)}>
            <QuestionBox />
          </div>
        </div>

        <div className="rise" style={delay(0.12)}>
          <FlingTile />
        </div>
      </div>
    </section>
  );
}

/**
 * The mark on its tile. Grab it anywhere: it lifts on press, follows the
 * pointer 1:1 from where it was grabbed, resists the further it goes, leans
 * into its own velocity, and on release springs home carrying that velocity.
 * Grab it again mid-flight and it simply follows again.
 */
function FlingTile() {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const lift = useMotionValue(1);
  const vx = useVelocity(x);
  const lean = useSpring(useTransform(vx, [-2400, 0, 2400], [-14, 0, 14]), { stiffness: 260, damping: 26 });
  const [held, setHeld] = useState(false);
  const start = useRef({ x: 0, y: 0 });

  const onPointerDown = usePan({
    axis: "free",
    threshold: 0,
    onDown: () => {
      // Interrupt whatever is in flight; the tile is wherever it is on screen right now.
      x.stop();
      y.stop();
      start.current = { x: x.get(), y: y.get() };
      setHeld(true);
      animate(lift, 1.04, reduce ? INSTANT : UI);
    },
    onMove: ({ dx, dy }) => {
      x.set(soft(start.current.x + dx, -40, 40, 260));
      y.set(soft(start.current.y + dy, -40, 40, 260));
    },
    onEnd: ({ vx: vX, vy: vY }) => release(vX, vY),
    onTap: () => release(0, 0),
  });

  function release(vX: number, vY: number) {
    setHeld(false);
    animate(lift, 1, reduce ? INSTANT : UI);
    // X and Y are separate springs, so a diagonal throw settles naturally.
    animate(x, 0, reduce ? INSTANT : { ...FLICK, velocity: vX });
    animate(y, 0, reduce ? INSTANT : { ...FLICK, velocity: vY });
  }

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[26rem] select-none">
      <motion.div
        onPointerDown={onPointerDown}
        style={{ x, y, scale: lift, rotate: reduce ? 0 : lean, touchAction: "none" }}
        className={`absolute inset-[10%] grid place-items-center rounded-[26%] bg-burgundy text-cream shadow-3 ${held ? "cursor-grabbing" : "cursor-grab"}`}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{ boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.14), inset 0 -1px 0 rgb(0 0 0 / 0.2)" }}
        />
        <LiveMark size={168} intro="full" track blink title="Diablo" />
      </motion.div>
      <p className="t-caption absolute inset-x-0 -bottom-2 text-center text-ink-3" aria-hidden>
        Grab it.
      </p>
    </div>
  );
}

/**
 * The questions people bring to Diablo, typed out. Tap to skip to the next one.
 * The first question is in the server HTML whole, so the box is never empty;
 * typing starts with the next one. It goes round once and stops, and holds
 * still while the pointer or focus is on it.
 */
function QuestionBox() {
  const [qi, setQi] = useState(0);
  const [n, setN] = useState(QUESTIONS[0].length);
  const [shown, setShown] = useState(1);
  const [held, setHeld] = useState(false);
  const q = QUESTIONS[qi];
  const done = shown > QUESTIONS.length;
  const typing = n < q.length;

  /** The next question: typed out, or whole when motion is reduced or the round is over. */
  const next = (reduce: boolean) => {
    const i = (qi + 1) % QUESTIONS.length;
    const whole = reduce || done || shown === QUESTIONS.length;
    setQi(i);
    setN(whole ? QUESTIONS[i].length : 0);
    setShown((s) => s + 1);
  };

  useEffect(() => {
    if (held || done) return;
    const reduce = reducedMotionNow();
    const t =
      typing && !reduce
        ? setTimeout(() => setN(n + 1), 38 + ((n * 37) % 40))
        : setTimeout(() => next(reduce), reduce ? 3600 : 2200);
    return () => clearTimeout(t);
    // `next` only reads state that is already a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, qi, held, done, typing]);

  return (
    <button
      type="button"
      onClick={() => next(reducedMotionNow())}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
      className="press block w-full rounded-[1.25rem] border bg-surface p-1.5 text-left shadow-2"
      aria-label={`Example question: ${q} Show the next one.`}
    >
      <span className="flex items-center gap-3 rounded-[0.9rem] bg-subtle px-4 py-3.5">
        <span className="t-overline shrink-0 rounded-md bg-accent px-1.5 py-0.5 text-[0.625rem] text-accent-ink">Ask</span>
        {/* Every question sits in the same cell, invisibly, so the box is as tall as the longest one and never moves the page. */}
        <span className="t-body grid flex-1 font-medium" aria-hidden>
          {QUESTIONS.map((x) => (
            <span key={x} className="invisible col-start-1 row-start-1">
              {x}
            </span>
          ))}
          <span className="col-start-1 row-start-1">
            {q.slice(0, n)}
            {!done && <span className="caret" />}
          </span>
        </span>
      </span>
      <span className="t-caption flex items-center gap-2 px-3 pb-1.5 pt-2.5 text-ink-3" aria-hidden>
        <span className="flex gap-1">
          {QUESTIONS.map((_, i) => (
            <span key={i} className={`h-1 rounded-full transition-all duration-300 ${i === qi ? "w-4 bg-accent-text" : "w-1 bg-line-strong"}`} />
          ))}
        </span>
        Questions Diablo is built to answer.
      </span>
    </button>
  );
}
