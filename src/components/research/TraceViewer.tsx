"use client";

import { AlertTriangle, Bot, ChevronRight, CornerDownRight, User, Wrench } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogClose } from "@/components/ui/Dialog";
import { SimulatedTag } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import type { Investigation, TraceStep } from "@/lib/data/types";
import { count, duration } from "@/lib/format";

const KIND: Record<TraceStep["kind"], { label: string; icon: typeof User }> = {
  user: { label: "User", icon: User },
  model: { label: "Model", icon: Bot },
  tool_call: { label: "Tool call", icon: Wrench },
  tool_result: { label: "Tool result", icon: CornerDownRight },
  error: { label: "Error", icon: AlertTriangle },
};

/** Step list for one sample. Shows only recorded fields: durations and tokens appear when they exist. */
export function TraceViewer({ inv, sampleId, onClose }: { inv: Investigation | null; sampleId: string | null; onClose: () => void }) {
  const sample = inv?.experiments.flatMap((e) => e.runs.flatMap((r) => r.samples)).find((s) => s.id === sampleId);
  const trace = sample?.traceId ? inv?.experiments.flatMap((e) => e.runs.flatMap((r) => r.traces)).find((t) => t.id === sample.traceId) : undefined;
  return (
    <Dialog open={!!sampleId} onOpenChange={(v) => !v && onClose()} title="Trace" variant="sheet-right" hideTitle>
      <div className="flex items-center gap-2 border-b border-line px-5 py-3">
        <h2 className="text-[16px] font-medium text-ink">Trace</h2>
        {sample?.simulated && <SimulatedTag />}
        <DialogClose className="ml-auto" />
      </div>
      <div className="quiet-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {!trace ? (
          <p className="text-ink-2">No trace was recorded for this sample.</p>
        ) : (
          <>
            <p className="font-mono text-[12px] text-ink-3">{sample!.id}</p>
            <ol className="mt-4 space-y-2">
              {trace.steps.map((step, i) => (
                <StepRow key={i} step={step} />
              ))}
            </ol>
          </>
        )}
      </div>
    </Dialog>
  );
}

function StepRow({ step }: { step: TraceStep }) {
  const [open, setOpen] = useState(step.kind !== "tool_call");
  const k = KIND[step.kind];
  const Icon = k.icon;
  const collapsible = step.kind === "tool_call";
  return (
    <li className={cn("rounded-[6px] border px-3 py-2", step.kind === "error" ? "border-bad" : "border-line")}>
      <div className="flex items-center gap-2 text-[13px]">
        <Icon className={cn("size-4 shrink-0", step.kind === "error" ? "text-bad" : "text-ink-3")} strokeWidth={1.5} aria-hidden />
        <span className={cn("font-medium", step.kind === "error" ? "text-bad" : "text-ink")}>{k.label}</span>
        {step.name && <span className="font-mono text-[13px] text-ink-2">{step.name}</span>}
        <span className="ml-auto flex gap-3 font-mono text-[12px] text-ink-3">
          {step.durationMs !== null && <span>{duration(step.durationMs)}</span>}
          {step.tokens !== null && <span>{count(step.tokens)} tokens</span>}
        </span>
        {collapsible && (
          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? "Hide arguments" : "Show arguments"}
            onClick={() => setOpen((v) => !v)}
            className="grid size-6 place-items-center rounded-[4px] text-ink-3 hover:bg-sunken"
          >
            <ChevronRight className={cn("size-4 transition-transform duration-150", open && "rotate-90")} strokeWidth={1.5} />
          </button>
        )}
      </div>
      {open && <pre className="mt-1.5 whitespace-pre-wrap break-words font-mono text-[13px] leading-5 text-ink-2">{step.content}</pre>}
    </li>
  );
}
