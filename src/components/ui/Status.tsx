import { cn } from "@/lib/cn";
import type { ExperimentStatus, InvestigationStatus } from "@/lib/data/types";

type AnyStatus = InvestigationStatus | ExperimentStatus;

export const STATUS_LABEL: Record<AnyStatus, string> = {
  draft: "Draft",
  proposed: "Proposed",
  running: "Running",
  "needs-review": "Needs review",
  complete: "Complete",
  replicated: "Replicated",
  failed: "Failed",
};

const DOT: Record<AnyStatus, string> = {
  running: "bg-accent-text running-pulse",
  "needs-review": "bg-warn",
  complete: "bg-ok",
  replicated: "bg-ok",
  draft: "border border-ink-3",
  proposed: "border border-ink-3",
  failed: "bg-bad",
};

/** A 6px status dot. Colour is never the only cue: the status is also in visually hidden text. */
export function StatusDot({ status, className, label = true }: { status: AnyStatus; className?: string; label?: boolean }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center", className)}>
      <span aria-hidden className={cn("size-1.5 rounded-full", DOT[status])} />
      {label && <span className="sr-only">{STATUS_LABEL[status]}</span>}
    </span>
  );
}

/** Dot and word, e.g. "● Running". */
export function StatusLabel({ status, className }: { status: AnyStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-ink-2", className)}>
      <StatusDot status={status} label={false} />
      {STATUS_LABEL[status]}
    </span>
  );
}
