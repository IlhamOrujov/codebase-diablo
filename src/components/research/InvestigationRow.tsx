"use client";

import Link from "next/link";
import { StatusDot } from "@/components/ui/Status";
import { Time } from "@/components/ui/primitives";
import { systemName } from "@/lib/data";
import { analyzeExperiment, finishedExperiments, investigationStatus } from "@/lib/data/derive";
import type { Investigation } from "@/lib/data/types";
import { formatCIpp, formatPP } from "@/lib/stats";

/** The key result, in words a row can carry. Derived from counts. */
export function keyResult(inv: Investigation): string {
  const status = investigationStatus(inv);
  const done = finishedExperiments(inv);
  if (status === "running") return `Running · ${done.length} of ${inv.experiments.length} experiment${inv.experiments.length === 1 ? "" : "s"}`;
  if (!done.length) return status === "failed" ? "Failed" : "Draft";
  const head = done.find((e) => e.design.primary) ?? done[0];
  const r = analyzeExperiment(head)!;
  return `Δ ${formatPP(r.diff)} · 95% CI ${formatCIpp(r.diffCI)}`;
}

/** One investigation as a row (Home and the Investigations page). The whole row is a link. */
export function InvestigationRow({ inv, now }: { inv: Investigation; now: number }) {
  return (
    <li>
      <Link
        href={`/investigations/${inv.id}`}
        className="group relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 transition-colors duration-150 hover:bg-sunken"
      >
        <span
          aria-hidden
          className="absolute bottom-2.5 left-0 top-2.5 w-0.5 origin-center scale-y-0 rounded-full bg-accent transition-transform duration-200 ease-out group-hover:scale-y-100 group-focus-visible:scale-y-100"
        />
        <StatusDot status={investigationStatus(inv)} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium text-ink">{inv.title}</span>
          <span className="block truncate text-[13px] text-ink-3">{systemName(inv.systemId)}</span>
        </span>
        <span className="hidden shrink-0 text-right font-mono text-[13px] text-ink-2 tabular sm:block">{keyResult(inv)}</span>
        <Time iso={inv.updatedAt} now={now} className="w-[92px] shrink-0 text-right text-[13px] text-ink-3" />
      </Link>
      <span className="block px-3 pb-1 font-mono text-[12px] text-ink-2 tabular sm:hidden">{keyResult(inv)}</span>
    </li>
  );
}

export function RowSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <ul aria-hidden className="space-y-1">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-3 px-3 py-3">
          <span className="size-1.5 rounded-full bg-line-strong" />
          <span className="flex-1 space-y-1.5">
            <span className="block h-3.5 w-1/2 rounded-[4px] bg-sunken" />
            <span className="block h-3 w-1/4 rounded-[4px] bg-sunken" />
          </span>
        </li>
      ))}
    </ul>
  );
}
