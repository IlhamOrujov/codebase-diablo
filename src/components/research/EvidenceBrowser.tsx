"use client";

import { useState } from "react";
import { Flag, FlagOff, ScrollText, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState, SimulatedTag } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { provider } from "@/lib/data";
import type { Experiment, Investigation, Sample } from "@/lib/data/types";
import { Mono } from "./common";

const PAGE = 50;

interface Row {
  inv: Investigation;
  exp: Experiment;
  s: Sample;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-[12px] text-ink-3">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 min-w-0 rounded-[6px] border border-line-field bg-surface px-2 text-[13px] text-ink"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Sample browser. Control and treatment responses for the same item sit side
 * by side; outcome labels come from each experiment's own metric. Flagging a
 * score is stored and feeds check C5.
 */
export function EvidenceBrowser({
  investigations,
  initialExperiment = "all",
  onOpenTrace,
  showInvestigation = false,
}: {
  investigations: Investigation[];
  initialExperiment?: string;
  onOpenTrace: (inv: Investigation, sampleId: string) => void;
  showInvestigation?: boolean;
}) {
  const [invF, setInvF] = useState("all");
  const [expF, setExpF] = useState(initialExperiment);
  const [arm, setArm] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const [scorer, setScorer] = useState("all");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const all: Row[] = investigations.flatMap((inv) =>
    inv.experiments.flatMap((exp) =>
      exp.runs.filter((r) => r.role === "primary").flatMap((r) => r.samples.map((s) => ({ inv, exp, s }))),
    ),
  );
  const scope = all.filter((x) => invF === "all" || x.inv.id === invF);
  const expKey = (x: Row) => `${x.inv.id}::${x.exp.id}`;
  const experiments = Array.from(new Map(scope.map((x) => [expKey(x), x])).values());
  const selectedExp = experiments.find((x) => expKey(x) === expF || (!showInvestigation && x.exp.id === expF));
  const scorers = Array.from(new Set(scope.map((x) => x.exp.design.scorer.name)));
  const needle = q.trim().toLowerCase();

  const rows = scope.filter(
    (x) =>
      (expF === "all" || expKey(x) === expF || (!showInvestigation && x.exp.id === expF)) &&
      (arm === "all" || x.s.arm === arm) &&
      (outcome === "all" || (outcome === "positive" ? x.s.score === 1 : x.s.score === 0)) &&
      (scorer === "all" || x.exp.design.scorer.name === scorer) &&
      (!needle || `${x.s.prompt} ${x.s.response} ${x.s.rationale ?? ""} ${x.s.id}`.toLowerCase().includes(needle)),
  );
  // Group into items: control and treatment of the same item, side by side.
  const groups = Array.from(
    rows.reduce((m, x) => {
      const k = `${x.inv.id}::${x.s.itemId}`;
      m.set(k, [...(m.get(k) ?? []), x]);
      return m;
    }, new Map<string, Row[]>()),
  );

  const outcomeLabels = selectedExp
    ? { pos: selectedExp.exp.design.metric.positiveLabel, neg: selectedExp.exp.design.metric.negativeLabel }
    : { pos: "Positive outcome (per metric)", neg: "Negative outcome (per metric)" };

  if (!all.length) return <EmptyState>No evidence yet. Run an experiment to collect scored samples.</EmptyState>;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {showInvestigation && (
          <Select
            label="Investigation"
            value={invF}
            onChange={(v) => {
              setInvF(v);
              setExpF("all");
            }}
            options={[{ value: "all", label: "All" }, ...investigations.filter((i) => all.some((x) => x.inv.id === i.id)).map((i) => ({ value: i.id, label: i.title }))]}
          />
        )}
        <Select
          label="Experiment"
          value={expF}
          onChange={setExpF}
          options={[
            { value: "all", label: "All" },
            ...experiments.map((x) => ({
              value: showInvestigation ? expKey(x) : x.exp.id,
              label: `${showInvestigation ? `${x.inv.title} · ` : ""}${x.exp.id} ${x.exp.title}`,
            })),
          ]}
        />
        <Select
          label="Arm"
          value={arm}
          onChange={setArm}
          options={[
            { value: "all", label: "Both" },
            { value: "control", label: selectedExp ? `Control · ${selectedExp.exp.design.control.label}` : "Control" },
            { value: "treatment", label: selectedExp ? `Treatment · ${selectedExp.exp.design.treatment.label}` : "Treatment" },
          ]}
        />
        <Select
          label="Outcome"
          value={outcome}
          onChange={setOutcome}
          options={[
            { value: "all", label: "All" },
            { value: "positive", label: outcomeLabels.pos },
            { value: "negative", label: outcomeLabels.neg },
          ]}
        />
        <Select label="Scorer" value={scorer} onChange={setScorer} options={[{ value: "all", label: "All" }, ...scorers.map((s) => ({ value: s, label: s }))]} />
        <label className={cn("flex min-w-0 flex-col gap-1 text-[12px] text-ink-3", showInvestigation ? "" : "col-span-2 sm:col-span-1 lg:col-span-2")}>
          Search
          <span className="field-box flex h-9 items-center gap-2 rounded-[6px] border border-line-field bg-surface px-2">
            <Search className="size-4 shrink-0 text-ink-3" strokeWidth={1.5} aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Prompt, response, id…"
              className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-3"
            />
          </span>
        </label>
      </div>
      <p className="mt-3 text-[13px] text-ink-2" aria-live="polite">
        Showing {rows.length} of {scope.length} samples, in {groups.length} item{groups.length === 1 ? "" : "s"}
      </p>

      {groups.length === 0 ? (
        <EmptyState className="mt-3">No samples match these filters.</EmptyState>
      ) : (
        <ul className="mt-3 space-y-3">
          {groups.slice(0, limit).map(([key, items]) => (
            <ItemCard key={key} items={items} onOpenTrace={onOpenTrace} showInvestigation={showInvestigation} />
          ))}
        </ul>
      )}
      {groups.length > limit && (
        <Button className="mt-3" onClick={() => setLimit((l) => l + PAGE)}>
          Show {Math.min(PAGE, groups.length - limit)} more
        </Button>
      )}
    </div>
  );
}

function ItemCard({ items, onOpenTrace, showInvestigation }: { items: Row[]; onOpenTrace: (inv: Investigation, sampleId: string) => void; showInvestigation: boolean }) {
  const { inv, exp } = items[0];
  const control = items.find((x) => x.s.arm === "control");
  const treatment = items.find((x) => x.s.arm === "treatment");
  const samePrompt = !control || !treatment || control.s.prompt === treatment.s.prompt;
  return (
    <li className="rounded-[10px] border border-line bg-surface p-4 [content-visibility:auto] [contain-intrinsic-size:auto_220px]">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-3">
        {showInvestigation && <span>{inv.title}</span>}
        {showInvestigation && <span aria-hidden>·</span>}
        <Mono className="text-[12px]">{exp.id}</Mono>
        <span>{exp.title}</span>
        <span aria-hidden>·</span>
        <span>{exp.design.metric.name}</span>
        {items.some((x) => x.s.simulated) && <SimulatedTag className="ml-auto" />}
      </div>
      {samePrompt && <p className="mt-2 text-ink">{(control ?? treatment)!.s.prompt}</p>}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {[control, treatment].map((x, i) =>
          x ? (
            <SampleView key={x.s.id} row={x} showPrompt={!samePrompt} onOpenTrace={onOpenTrace} />
          ) : (
            <div key={i} className="hidden md:block" />
          ),
        )}
      </div>
    </li>
  );
}

function SampleView({ row, showPrompt, onOpenTrace }: { row: Row; showPrompt: boolean; onOpenTrace: (inv: Investigation, sampleId: string) => void }) {
  const { inv, exp, s } = row;
  const d = exp.design;
  return (
    <div className={cn("flex flex-col rounded-[6px] border p-3", s.flagged ? "border-warn" : "border-line")}>
      <div className="flex items-center gap-2 text-[12px] text-ink-3">
        <span className="text-ink-2">
          {s.arm === "control" ? "Control" : "Treatment"} · {s.arm === "control" ? d.control.label : d.treatment.label}
        </span>
      </div>
      {showPrompt && <p className="mt-1.5 text-[13px] text-ink-2">{s.prompt}</p>}
      <p className="mt-1.5 whitespace-pre-line text-ink">{s.response}</p>
      <div className="mt-2 text-[13px]">
        <span className="text-ink">{s.score ? d.metric.positiveLabel : d.metric.negativeLabel}</span>
        <span className="text-ink-3">
          {" "}
          · score <Mono>{s.score}</Mono> · {d.scorer.name}
        </span>
      </div>
      {s.rationale && <p className="mt-1 text-[13px] text-ink-2">{s.rationale}</p>}
      <div className="mt-auto flex flex-wrap items-center gap-1 pt-2">
        <Mono className="mr-auto truncate text-[12px] text-ink-3" >{s.id.split("/").slice(-3).join("/")}</Mono>
        <Button
          size="sm"
          variant="ghost"
          aria-pressed={s.flagged}
          icon={s.flagged ? <FlagOff strokeWidth={1.5} /> : <Flag strokeWidth={1.5} />}
          onClick={() => provider.toggleFlag(inv.id, s.id)}
        >
          {s.flagged ? "Unflag score" : "Flag score"}
        </Button>
        {s.traceId && (
          <Button size="sm" variant="ghost" icon={<ScrollText strokeWidth={1.5} />} onClick={() => onOpenTrace(inv, s.id)}>
            Open trace
          </Button>
        )}
      </div>
    </div>
  );
}
