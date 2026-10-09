"use client";

import { Check, CircleDashed, CircleHelp, Minus, X, AlertTriangle } from "lucide-react";
import { Fragment, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { Verdict } from "@/lib/data/derive";
import { VERDICT_LABEL } from "@/lib/data/interpret";
import type { CheckState } from "@/lib/validity";

export function useMediaQuery(query: string, server = false): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => matchMedia(query).matches,
    () => server,
  );
}

/** Verdict as text plus icon (never colour alone, never strikethrough). */
export function VerdictTag({ verdict, className }: { verdict: Verdict; className?: string }) {
  const icon =
    verdict === "supported" ? (
      <Check className="size-4 text-ok" strokeWidth={2} aria-hidden />
    ) : verdict === "rejected" ? (
      <X className="size-4 text-bad" strokeWidth={2} aria-hidden />
    ) : verdict === "partly-supported" ? (
      <CircleHelp className="size-4 text-warn" strokeWidth={1.5} aria-hidden />
    ) : (
      <CircleDashed className="size-4 text-ink-3" strokeWidth={1.5} aria-hidden />
    );
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 text-[13px] text-ink-2", className)}>
      {icon}
      {VERDICT_LABEL[verdict]}
    </span>
  );
}

const CHECK_SYMBOL: Record<CheckState, { sym: ReactNode; label: string }> = {
  pass: { sym: <Check className="size-4 text-ok" strokeWidth={2} aria-hidden />, label: "Pass" },
  warn: { sym: <AlertTriangle className="size-4 text-warn" strokeWidth={1.5} aria-hidden />, label: "Warning" },
  fail: { sym: <X className="size-4 text-bad" strokeWidth={2} aria-hidden />, label: "Fails" },
  unknown: { sym: <Minus className="size-4 text-ink-3" strokeWidth={2} aria-hidden />, label: "Not recorded or not yet" },
  na: { sym: <Minus className="size-4 text-ink-3" strokeWidth={2} aria-hidden />, label: "Does not apply" },
  info: { sym: <span aria-hidden className="block size-1.5 rounded-full bg-ink-2" />, label: "Result" },
};

export function CheckSymbol({ state }: { state: CheckState }) {
  const s = CHECK_SYMBOL[state];
  return (
    <span className="grid size-4 shrink-0 place-items-center" title={s.label}>
      {s.sym}
      <span className="sr-only">{s.label}:</span>
    </span>
  );
}

/** Turns "E1" and "H2" in a sentence into buttons that open the object. */
export function RefText({ text, onRef, className }: { text: string; onRef: (id: string) => void; className?: string }) {
  const parts = text.split(/\b([EH]\d+)\b/g);
  return (
    <span className={className}>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <button
            key={i}
            type="button"
            onClick={() => onRef(p)}
            className="rounded-[3px] font-mono text-[0.92em] text-accent-text underline decoration-1 underline-offset-2 hover:decoration-2"
          >
            {p}
          </button>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </span>
  );
}

/** A definition list for detail panels. Missing values read "Not recorded". */
export function Facts({ rows, className }: { rows: [string, ReactNode | null | undefined][]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-[minmax(110px,40%)_1fr] gap-x-4 gap-y-1.5 text-[13px]", className)}>
      {rows.map(([k, v]) => (
        <Fragment key={k}>
          <dt className="text-ink-3">{k}</dt>
          <dd className="min-w-0 break-words text-ink">{v === null || v === undefined || v === "" ? <NotRecorded /> : v}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

export function NotRecorded() {
  return <span className="text-ink-3">Not recorded</span>;
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("font-mono text-[13px] tabular", className)}>{children}</span>;
}
