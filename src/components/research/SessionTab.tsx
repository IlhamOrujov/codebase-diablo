"use client";

import { useState } from "react";
import {
  ChevronRight,
  CircleCheck,
  FlaskConical,
  Flag,
  LineChart,
  ListChecks,
  MessageSquare,
  NotebookPen,
  Play,
  User,
} from "lucide-react";
import { useReducedMotion } from "motion/react";
import { Composer } from "@/components/home/Composer";
import { Button } from "@/components/ui/Button";
import { Progress, Time } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { provider, useNow } from "@/lib/data";
import { analyzeExperiment, primaryRun, runProgress, verdictFor } from "@/lib/data/derive";
import { resultLine } from "@/lib/data/interpret";
import type { Experiment, SessionEvent } from "@/lib/data/types";
import { count, duration } from "@/lib/format";
import { useMotionPref } from "@/lib/prefs";
import { Facts, Mono, RefText, VerdictTag } from "./common";
import { useWS } from "./context";

const PHASE: Record<SessionEvent["kind"], string> = {
  question: "Question",
  hypotheses: "Hypotheses",
  design: "Design",
  "run-started": "Runs",
  "run-finished": "Runs",
  analysis: "Analysis",
  conclusion: "Conclusion",
  note: "Notes",
  ask: "Questions",
  answer: "Questions",
};

const ICON: Record<SessionEvent["kind"], typeof Play> = {
  question: MessageSquare,
  hypotheses: ListChecks,
  design: FlaskConical,
  "run-started": Play,
  "run-finished": CircleCheck,
  analysis: LineChart,
  conclusion: Flag,
  note: NotebookPen,
  ask: User,
  answer: MessageSquare,
};

/** Reveal fresh answers sentence by sentence (never word by word, never blurred). */
const SENTENCE_MS = 260;
const FRESH_MS = 6000;

export function SessionTab() {
  const { inv, openRef } = useWS();
  const systemReduce = useReducedMotion();
  const pref = useMotionPref();
  const reduce = systemReduce || pref === "reduce";
  const running = inv.experiments.some((e) => e.status === "running");
  // Pending events (a new investigation's log arriving) and fresh answers need a fast clock; running rows need 1 s.
  const [clock, setClock] = useState<{ fast: boolean; active: boolean }>({ fast: true, active: true });
  const now = useNow(clock.fast ? 150 : 1000, clock.active || running);
  const pending = inv.events.some((e) => Date.parse(e.at) > now);
  const lastAnswer = [...inv.events].reverse().find((e) => e.kind === "answer");
  const fresh = !!lastAnswer && now - Date.parse(lastAnswer.at) < FRESH_MS && !reduce;
  const wanted = { fast: pending || fresh, active: pending || fresh };
  if (wanted.fast !== clock.fast || wanted.active !== clock.active) setClock(wanted);

  const visible = reduce ? inv.events : inv.events.filter((e) => Date.parse(e.at) <= now);
  const arriving = !reduce && visible.length < inv.events.length;

  const rows = visible.slice(1).map((ev, i, arr) => ({ ev, header: i === 0 || PHASE[arr[i - 1].kind] !== PHASE[ev.kind] }));
  return (
    <div className="mx-auto max-w-[760px]">
      <p className="font-serif text-[18px] leading-[28px] text-ink">{inv.question}</p>
      {inv.templateDraft && (
        <p className="mt-2 text-[13px] text-ink-3">
          Template draft: the demo agent did not recognise this topic, so the plan below is generic and quotes your question.
        </p>
      )}

      <ol className="mt-6" aria-label="Session log" aria-busy={arriving || undefined}>
        {rows.map(({ ev, header }) => (
          <li key={ev.id}>
            {header && <div className="mb-1 mt-5 text-[12px] text-ink-3 first:mt-0">{PHASE[ev.kind]}</div>}
            <EventRow ev={ev} now={now} reduce={reduce} onRef={openRef} />
          </li>
        ))}
      </ol>
      {arriving && <p className="mt-3 text-[13px] text-ink-3">Planning…</p>}

      <div className="sticky bottom-0 z-10 -mx-1 mt-8 bg-gradient-to-t from-bg from-70% to-transparent px-1 pb-4 pt-6">
        <Composer
          id={`ask-${inv.id}`}
          label="Ask about this investigation or add a note"
          placeholder="Ask about this investigation or add a note…"
          onSubmit={(text) => provider.ask(inv.id, text)}
          left={<span className="px-2 text-[12px] text-ink-3">Answers come from this investigation&apos;s data (demo, rule-based).</span>}
          extra={(text, clear) => (
            <Button
              size="sm"
              variant="ghost"
              disabledReason={text.trim() ? undefined : "Type a note first"}
              onClick={() => {
                provider.addNote(inv.id, text);
                clear();
              }}
            >
              Save as note
            </Button>
          )}
        />
      </div>
    </div>
  );
}

function EventRow({ ev, now, reduce, onRef }: { ev: SessionEvent; now: number; reduce: boolean; onRef: (id: string) => void }) {
  const { inv } = useWS();
  const [open, setOpen] = useState(false);
  const Icon = ICON[ev.kind];
  const exp = ev.experimentId ? inv.experiments.find((e) => e.id === ev.experimentId) : undefined;
  const run = exp ? primaryRun(exp) : null;
  const result = exp && ev.kind === "run-finished" && !/^Replicated/.test(ev.text) ? analyzeExperiment(exp) : null;
  const liveRun = ev.kind === "run-started" && exp?.status === "running" ? exp.runs.find((r) => r.finishedAt === null) : undefined;
  const expandable = (ev.kind === "design" || ev.kind === "run-finished" || ev.kind === "run-started") && !!exp;

  const meta = (
    <span className="ml-auto flex shrink-0 items-center gap-3 pl-3 text-[12px] text-ink-3">
      {ev.kind === "run-finished" && run?.finishedAt && <span className="font-mono">{duration(Date.parse(run.finishedAt) - Date.parse(run.startedAt))}</span>}
      {result && <span className="font-mono">n = {count(result.control.n + result.treatment.n)}</span>}
      <Time iso={ev.at} now={now} />
      {expandable && (
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${open ? "Hide" : "Show"} details for ${exp?.id}`}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          className="-my-1 grid size-7 place-items-center rounded-[6px] text-ink-3 hover:bg-sunken hover:text-ink"
        >
          <ChevronRight aria-hidden className={cn("size-4 transition-transform duration-150", open && "rotate-90")} strokeWidth={1.5} />
        </button>
      )}
    </span>
  );

  const body =
    ev.kind === "analysis" || ev.kind === "conclusion" ? (
      <div className="min-w-0 flex-1">
        <div className="text-[12px] text-ink-3">Interpretation{ev.kind === "conclusion" ? " · conclusion" : ""}</div>
        <p className="mt-0.5 font-serif text-[16px] leading-[26px] text-ink">
          <RefText text={ev.text} onRef={onRef} />
        </p>
      </div>
    ) : ev.kind === "answer" ? (
      <Answer ev={ev} now={now} reduce={reduce} onRef={onRef} />
    ) : (
      <div className="min-w-0 flex-1">
        <p className={cn("text-ink", ev.kind === "ask" && "font-medium", ev.kind === "note" && "text-ink-2")}>
          {ev.kind === "note" ? <>Note: {ev.text}</> : <RefText text={ev.text} onRef={onRef} />}
        </p>
        {result && exp && <p className="mt-1 font-mono text-[13px] text-ink-2 tabular">{resultLine(exp, result)}</p>}
        {liveRun && exp && <LiveLine exp={exp} now={now} />}
        {ev.kind === "hypotheses" && (
          <ul className="mt-2 space-y-1.5">
            {inv.hypotheses
              .filter((h) => ev.refs.includes(h.id))
              .map((h) => (
                <li key={h.id} className="flex items-start gap-2">
                  <Mono className="pt-px text-ink-3">{h.id}</Mono>
                  <span className="flex-1 text-ink-2">
                    {h.text}
                    {h.competing && <span className="text-ink-3"> (competing explanation)</span>}
                  </span>
                  <VerdictTag verdict={verdictFor(inv, h).verdict} />
                </li>
              ))}
          </ul>
        )}
      </div>
    );

  return (
    <div className="rounded-[10px] transition-colors duration-150">
      <div
        className={cn("flex items-start gap-3 rounded-[10px] px-2 py-2", expandable && "cursor-pointer hover:bg-sunken/60")}
        onClick={expandable ? (e) => !(e.target as HTMLElement).closest("button,a") && setOpen((v) => !v) : undefined}
      >
        <Icon className="mt-0.5 size-4 shrink-0 text-ink-3" strokeWidth={1.5} aria-hidden />
        {body}
        {meta}
      </div>
      {expandable && open && exp && <EventDetails exp={exp} onRef={onRef} />}
    </div>
  );
}

function LiveLine({ exp, now }: { exp: Experiment; now: number }) {
  const run = exp.runs.find((r) => r.finishedAt === null);
  if (!run) return null;
  const p = runProgress(run, now);
  const total = exp.design.nPerArm * 2;
  return (
    <div className="mt-1.5">
      <div className="font-mono text-[13px] text-ink-2 tabular">
        {exp.id} · {count(Math.floor(p * total))} of {count(total)} scored
      </div>
      <Progress value={p} label={`${exp.id} progress`} className="mt-1.5 max-w-[320px]" />
    </div>
  );
}

function EventDetails({ exp, onRef }: { exp: Experiment; onRef: (id: string) => void }) {
  const d = exp.design;
  const r = analyzeExperiment(exp);
  const keys = Array.from(new Set([...Object.keys(d.control.config), ...Object.keys(d.treatment.config)])).filter(
    (k) => d.control.config[k] !== d.treatment.config[k],
  );
  return (
    <div className="mb-2 ml-9 mr-2 rounded-[10px] border border-line bg-surface p-3">
      <Facts
        rows={[
          ["Dataset", d.datasetId ? <Mono key="d">{d.datasetId}</Mono> : null],
          ["Control", d.control.label],
          ["Treatment", d.treatment.label],
          ["What changes", keys.length ? <Mono key="k">{keys.map((k) => `${k}: ${d.control.config[k] ?? "—"} → ${d.treatment.config[k] ?? "—"}`).join("; ")}</Mono> : "Nothing recorded"],
          ["Seed", d.seed !== null ? <Mono key="s">{d.seed}</Mono> : null],
          ["Planned", `${count(d.nPerArm)} per arm, ${d.pairing}`],
        ]}
      />
      {r && (
        <table className="mt-3 w-full text-[13px]">
          <thead>
            <tr className="text-left text-ink-3">
              <th scope="col" className="py-1 pr-3 font-normal">
                Arm
              </th>
              <th scope="col" className="py-1 pr-3 font-normal">
                k / n
              </th>
              <th scope="col" className="py-1 font-normal">
                Rate
              </th>
            </tr>
          </thead>
          <tbody className="font-mono tabular">
            <tr>
              <td className="py-1 pr-3 font-sans">{d.control.label}</td>
              <td className="py-1 pr-3">
                {r.control.k} / {r.control.n}
              </td>
              <td className="py-1">{(r.control.rate * 100).toFixed(1)}%</td>
            </tr>
            <tr>
              <td className="py-1 pr-3 font-sans">{d.treatment.label}</td>
              <td className="py-1 pr-3">
                {r.treatment.k} / {r.treatment.n}
              </td>
              <td className="py-1">{(r.treatment.rate * 100).toFixed(1)}%</td>
            </tr>
          </tbody>
        </table>
      )}
      <Button size="sm" className="mt-3" onClick={() => onRef(exp.id)}>
        Open experiment
      </Button>
    </div>
  );
}

function Answer({ ev, now, reduce, onRef }: { ev: SessionEvent; now: number; reduce: boolean; onRef: (id: string) => void }) {
  // Whole sentences: split only where punctuation is followed by a space and a capital (never inside "8.5").
  const sentences = ev.text.split(/(?<=[.!?])\s+(?=[A-Z(])/);
  const age = now - Date.parse(ev.at);
  // Only an answer that arrived while you watched is revealed progressively.
  const [fresh] = useState(() => age < FRESH_MS);
  const shown = reduce || !fresh ? sentences.length : Math.min(sentences.length, 1 + Math.floor(Math.max(0, age) / SENTENCE_MS));
  const streaming = shown < sentences.length;
  return (
    <div className="min-w-0 flex-1">
      <div className="text-[12px] text-ink-3">Answer · from this investigation&apos;s data</div>
      <p aria-live="polite" aria-busy={streaming || undefined} className="mt-0.5 font-serif text-[16px] leading-[26px] text-ink">
        <RefText text={sentences.slice(0, shown).join(" ")} onRef={onRef} />
      </p>
    </div>
  );
}
