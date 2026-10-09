"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { animate, motion, useInView, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform, type MotionValue } from "motion/react";
import { SectionHead } from "@/components/Reveal";
import { INSTANT, MOVE, SHEET, clamp, onScreen, project, reducedMotionNow, soft, tick, usePan } from "@/lib/motion";

const STAGES = ["Question", "Hypotheses", "Experiments", "Evidence", "Conclusion"];
const LAST = STAGES.length - 1;

/** The worked example. Counts and statistics are real outputs of Diablo's statistics code. */
const EXPERIMENTS = [
  { id: "E1", hyp: "H1", change: "Only the system prompt changes", control: 69, treatment: 57, n: 80, found: true, verdict: "Effect · Δ −15.0 pp · p = 0.012" },
  { id: "E2", hyp: "H2", change: "Only the temperature changes", control: 69, treatment: 68, n: 80, found: false, verdict: "No effect · Δ −1.3 pp · p > 0.99" },
];

/** 0 before a stage is reached, 1 once it is: continuous, so scrubbing feels like scrubbing. */
const useStage = (p: MotionValue<number>, s: number) => useTransform(p, [s - 0.6, s], [0, 1], { clamp: true });

export function Investigation() {
  const reduce = useReducedMotion();
  // The server HTML shows the finished investigation, so it reads fully without
  // JavaScript and under reduced motion. Below the fold it is rewound on load
  // and plays once it is seen.
  const p = useMotionValue(LAST);
  const rail = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const seen = useInView(box, { once: true, margin: "0px 0px -30% 0px" });
  const [stage, setStage] = useState(LAST);
  const [playing, setPlaying] = useState(false);
  const armed = useRef(false);
  /** Where the knob is headed, so quick key presses add up even mid-animation. */
  const aim = useRef(LAST);
  const run = useRef(0);
  const start = useRef(0);

  useMotionValueEvent(p, "change", (v) => {
    const s = clamp(Math.floor(v + 0.001), 0, LAST);
    setStage((cur) => (cur === s ? cur : s));
  });

  /** Plays stage by stage; any touch stops it where it is. */
  async function play(from = p.get()) {
    const id = ++run.current;
    setPlaying(true);
    if (reduce) {
      p.set(LAST);
      setPlaying(false);
      return;
    }
    if (from < 0) {
      p.set(0);
      from = 0;
    }
    for (let s = Math.floor(from) + 1; s <= LAST; s++) {
      aim.current = s;
      await animate(p, s, s === 3 ? { duration: 1.6, ease: [0.4, 0, 0.2, 1] } : MOVE);
      if (run.current !== id) return;
      await new Promise((r) => setTimeout(r, 900));
      if (run.current !== id) return;
    }
    setPlaying(false);
  }
  function stop() {
    run.current++;
    p.stop();
    setPlaying(false);
  }

  useLayoutEffect(() => {
    if (reducedMotionNow() || !box.current || onScreen(box.current)) return;
    armed.current = true;
    p.set(0);
  }, [p]);

  useEffect(() => {
    if (!seen || !armed.current) return;
    armed.current = false;
    const t = setTimeout(() => play(0), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen]);

  const goTo = (s: number) => {
    stop();
    aim.current = s;
    animate(p, s, reduce ? INSTANT : MOVE);
  };

  const onPointerDown = usePan({
    axis: "x",
    threshold: 3,
    onDown: (e) => {
      stop();
      // Pressing the rail jumps the knob under the finger, then it tracks from there.
      const r = rail.current!.getBoundingClientRect();
      const at = clamp(((e.clientX - r.left) / r.width) * LAST, 0, LAST);
      start.current = at;
      animate(p, at, reduce ? INSTANT : { type: "spring", bounce: 0, visualDuration: 0.15 });
    },
    onStart: () => p.stop(),
    onMove: ({ dx }) => {
      const w = rail.current!.getBoundingClientRect().width;
      p.set(soft(start.current + (dx / w) * LAST, 0, LAST, 1.2));
    },
    onEnd: ({ vx }) => {
      const w = rail.current!.getBoundingClientRect().width;
      const v = (vx / w) * LAST;
      const to = clamp(Math.round(p.get() + project(v)), 0, LAST);
      tick();
      animate(p, to, reduce ? INSTANT : { ...SHEET, velocity: v });
    },
    onTap: () => {
      animate(p, clamp(Math.round(start.current), 0, LAST), reduce ? INSTANT : MOVE);
    },
  });

  const knob = useTransform(p, (v) => `${(clamp(v, -0.3, LAST + 0.3) / LAST) * 100}%`);
  const fill = useTransform(p, (v) => `${(clamp(v, 0, LAST) / LAST) * 100}%`);

  return (
    <section className="border-t">
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <SectionHead eyebrow="An example" title="Watch Diablo find a cause.">
          Version two of an assistant got worse at arithmetic. Two things changed at once. Which one did it?
        </SectionHead>

        <div ref={box} className="mt-12 overflow-clip rounded-[1.75rem] border bg-surface shadow-2">
          {/* Scrubber */}
          <div className="flex items-center gap-4 border-b px-5 py-5 sm:px-7">
            <button
              type="button"
              onClick={() => (playing ? stop() : play(stage === LAST ? -1 : p.get()))}
              aria-label={playing ? "Pause" : stage === LAST ? "Replay" : "Play"}
              className="press grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-ink"
            >
              {playing ? (
                <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
                  <path d="M5 3.5v9M11 3.5v9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
                  <path d="M5 3.2v9.6L12.5 8Z" fill="currentColor" />
                </svg>
              )}
            </button>
            <div className="min-w-0 flex-1">
              <div
                ref={rail}
                onPointerDown={onPointerDown}
                role="slider"
                tabIndex={0}
                aria-label="Investigation stage"
                aria-valuemin={1}
                aria-valuemax={STAGES.length}
                aria-valuenow={stage + 1}
                aria-valuetext={STAGES[stage]}
                onKeyDown={(e) => {
                  const from = p.isAnimating() ? aim.current : stage;
                  const to = {
                    ArrowRight: from + 1,
                    ArrowUp: from + 1,
                    ArrowLeft: from - 1,
                    ArrowDown: from - 1,
                    Home: 0,
                    End: LAST,
                  }[e.key];
                  if (to === undefined) return;
                  e.preventDefault();
                  goTo(clamp(to, 0, LAST));
                }}
                style={{ touchAction: "pan-y" }}
                className="relative h-10 cursor-pointer select-none"
              >
                <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-line" />
                <motion.div className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-accent-text" style={{ width: fill }} />
                {STAGES.map((s, i) => (
                  <span
                    key={s}
                    className={`absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors ${i <= stage ? "bg-accent-text" : "bg-line-strong"}`}
                    style={{ left: `${(i / LAST) * 100}%` }}
                  />
                ))}
                <motion.span
                  className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent shadow-3"
                  style={{ left: knob }}
                />
              </div>
              <div className="relative mt-1 hidden h-4 sm:block">
                {STAGES.map((s, i) => (
                  <button
                    key={s}
                    type="button"
                    tabIndex={-1}
                    onClick={() => goTo(i)}
                    className={`t-caption absolute -translate-x-1/2 whitespace-nowrap font-semibold transition-colors first:translate-x-0 last:-translate-x-full ${
                      i === stage ? "text-ink" : "text-ink-3 hover:text-ink"
                    }`}
                    style={{ left: `${(i / LAST) * 100}%` }}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <p className="t-caption mt-1 font-semibold sm:hidden">{STAGES[stage]}</p>
            </div>
          </div>

          <Stages p={p} concluded={stage === LAST} />
        </div>
        <p className="t-caption mt-4 text-ink-3">
          An illustrative example, not customer data. Every statistic in it is computed by Diablo’s own code.
        </p>
      </div>
    </section>
  );
}

function Stages({ p, concluded }: { p: MotionValue<number>; concluded: boolean }) {
  const q = useStage(p, 0);
  const h = useStage(p, 1);
  const e = useStage(p, 2);
  const v = useStage(p, 3);
  const c = useStage(p, 4);
  const fillAmount = useTransform(p, [2.2, 3], [0, 1], { clamp: true });
  const qs = useLift(q);
  const hs = useLift(h);
  const es = useLift(e);
  const cs = useLift(c);

  return (
    <div className="grid gap-px bg-line lg:grid-cols-[1fr_1.5fr_1fr]">
      <div className="bg-surface p-6">
        <motion.div style={qs}>
          <p className="t-overline text-ink-3">Question</p>
          <p className="t-headline mt-2">Why did Helper v2 get worse at arithmetic?</p>
        </motion.div>
        <motion.div style={hs} className="mt-7 space-y-3">
          {[
            { id: "H1", text: "The shorter system prompt", win: true },
            { id: "H2", text: "The higher temperature", win: false },
          ].map((x) => (
            <div key={x.id} className="rounded-2xl border bg-subtle p-3.5">
              <p className="t-overline flex items-center gap-2 text-ink-3">
                {x.id} · competing
                <motion.span style={{ opacity: c }} className={`ml-auto normal-case tracking-normal ${x.win ? "text-ok" : ""}`}>
                  {x.win ? "supported" : "ruled out"}
                </motion.span>
              </p>
              {/* Ruled out reads as struck through, never faded: faded text would fall below 4.5:1. */}
              <p
                className={`t-body mt-1 font-medium decoration-[1.5px] transition-[text-decoration-color] duration-300 ${
                  x.win ? "" : `line-through ${concluded ? "decoration-ink-3" : "decoration-transparent"}`
                }`}
              >
                {x.text}
              </p>
            </div>
          ))}
        </motion.div>
      </div>

      <div className="bg-surface p-6">
        <motion.div style={es}>
          <p className="t-overline text-ink-3">Experiments · the same 80 problems in both arms</p>
          <div className="mt-4 space-y-4">
            {EXPERIMENTS.map((x) => (
              <div key={x.id} className="rounded-2xl border bg-subtle p-4">
                <p className="t-callout flex items-center justify-between gap-2 font-semibold">
                  <span>
                    {x.id} <span className="font-normal text-ink-3">· {x.change}</span>
                  </span>
                  <span className="t-caption shrink-0 font-mono text-ink-3">tests {x.hyp}</span>
                </p>
                <div className="mt-3 space-y-2">
                  <Bar label="v1" k={x.control} n={x.n} amount={fillAmount} strong={false} />
                  <Bar label="v2" k={x.treatment} n={x.n} amount={fillAmount} strong />
                </div>
                <motion.p
                  style={{ opacity: v }}
                  className={`t-caption mt-3 inline-flex rounded-full px-2.5 py-1 font-mono font-semibold ${x.found ? "bg-accent-tint-2 text-accent-text" : "bg-sunken text-ink-3"}`}
                >
                  {x.verdict}
                </motion.p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="bg-surface p-6">
        <motion.div style={cs}>
          <p className="t-overline text-ink-3">Conclusion</p>
          <p className="t-headline mt-2">The system prompt caused the drop. The temperature did not.</p>
          <p className="t-callout mt-3 text-ink-2">Next: restore the prompt in v2 and verify the fix with a new experiment.</p>
          <p className="t-callout mt-6 inline-flex items-center gap-2 rounded-full bg-burgundy px-3.5 py-2 font-semibold text-cream">
            <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
              <path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Report ready
          </p>
        </motion.div>
      </div>
    </div>
  );
}

/** Fades in and settles upward as its stage is reached. */
function useLift(o: MotionValue<number>) {
  const y = useTransform(o, [0, 1], [10, 0]);
  return { opacity: o, y };
}

function Bar({ label, k, n, amount, strong }: { label: string; k: number; n: number; amount: MotionValue<number>; strong: boolean }) {
  const width = useTransform(amount, (a) => `${(k / n) * a * 100}%`);
  const count = useTransform(amount, (a) => Math.round(k * a));
  return (
    <div className="flex items-center gap-3">
      <span className="t-caption w-5 font-mono text-ink-3">{label}</span>
      <div className="h-2.5 flex-1 overflow-clip rounded-full bg-line">
        <motion.div className={`h-full rounded-full ${strong ? "bg-accent-text" : "bg-ink-3"}`} style={{ width }} />
      </div>
      <span className="t-caption w-14 text-right font-mono tabular-nums text-ink-2">
        <motion.span>{count}</motion.span>/{n}
      </span>
    </div>
  );
}
