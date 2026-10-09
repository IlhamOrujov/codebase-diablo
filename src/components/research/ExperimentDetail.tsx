"use client";

import Link from "next/link";
import { Copy, Play, Repeat, RotateCcw } from "lucide-react";
import { PairedRates, replicationResults } from "@/components/charts/Charts";
import { Button } from "@/components/ui/Button";
import { StatusLabel } from "@/components/ui/Status";
import { Interpretation, Progress, SimulatedTag, ScrollRegion } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { provider, useNow } from "@/lib/data";
import { analyzeExperiment, holmAdjusted, primaryRun, runProgress, verdictFor } from "@/lib/data/derive";
import { effectSizeLabel, experimentInterpretation } from "@/lib/data/interpret";
import type { Experiment } from "@/lib/data/types";
import { absoluteTime, count, duration } from "@/lib/format";
import { formatCIpp, formatP, formatPct, formatPP, signed } from "@/lib/stats";
import { toast } from "@/lib/ui";
import { familyOf } from "@/lib/data";
import { experimentChecks, RUBRIC_LABEL } from "@/lib/validity";
import { CheckSymbol, Facts, Mono, VerdictTag } from "./common";
import { useWS } from "./context";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-4 first:border-t-0 first:pt-0">
      <h3 className="mb-2 text-[13px] font-medium text-ink">{title}</h3>
      {children}
    </section>
  );
}

/** Everything a researcher needs to check one experiment, in the order of the project brief. */
export function ExperimentDetail({ exp }: { exp: Experiment }) {
  const { inv, showEvidence, openTrace } = useWS();
  const now = useNow(1000, exp.status === "running");
  const d = exp.design;
  const run = primaryRun(exp);
  const r = analyzeExperiment(exp);
  const h = inv.hypotheses.find((x) => x.id === exp.hypothesisId);
  const target = provider.getSystem(d.treatment.systemId);
  const dataset = d.datasetId ? provider.getDataset(d.datasetId) : undefined;
  const checks = experimentChecks(inv, exp, familyOf);
  const holm = holmAdjusted(inv).get(exp.id);
  const reps = replicationResults(exp);
  const samples = exp.runs.filter((x) => x.role === "primary").flatMap((x) => x.samples);
  const traced = samples.find((s) => s.traceId);
  const keys = Array.from(new Set([...Object.keys(d.control.config), ...Object.keys(d.treatment.config)]));
  const sameFamily = d.scorer.kind === "judge" && d.scorer.family && d.scorer.family === familyOf(d.treatment.systemId);
  const progress = run && exp.status === "running" ? runProgress(run, now) : null;

  const bundle = () =>
    JSON.stringify(
      {
        investigation: inv.id,
        experiment: exp.id,
        title: exp.title,
        design: d,
        run: run && { ...run, samples: undefined, traces: undefined },
        result: r && { control: r.control, treatment: r.treatment, diff: r.diff, diffCI: r.diffCI, test: r.test, p: r.p, cohensH: r.cohensH },
        source: provider.label,
      },
      null,
      2,
    );

  return (
    <div className="text-[14px]">
      <header className="pb-4">
        <div className="flex items-center gap-2 text-[13px] text-ink-3">
          <Mono>{exp.id}</Mono>
          <span aria-hidden>·</span>
          <StatusLabel status={exp.status} />
        </div>
        <h2 className="mt-1 text-[18px] font-medium leading-6 text-ink">{exp.title}</h2>
        {run && (
          <div className="mt-1 truncate font-mono text-[12px] text-ink-3" title={run.id}>
            run {run.id.split("/").slice(1).join("/")}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {exp.status === "proposed" || exp.status === "failed" ? (
            <Button size="sm" variant="primary" icon={<Play strokeWidth={1.5} />} onClick={() => provider.runExperiment(inv.id, exp.id)}>
              Run
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                icon={<RotateCcw strokeWidth={1.5} />}
                disabledReason={exp.status === "running" ? "Wait for the current run to finish" : undefined}
                onClick={() => provider.rerunExperiment(inv.id, exp.id)}
              >
                Re-run
              </Button>
              <Button
                size="sm"
                icon={<Repeat strokeWidth={1.5} />}
                disabledReason={exp.status !== "complete" ? "Replicate after the run finishes" : undefined}
                onClick={() => provider.replicateExperiment(inv.id, exp.id)}
              >
                Replicate
              </Button>
            </>
          )}
        </div>
        {progress !== null && run && (
          <div className="mt-3">
            <div className="font-mono text-[13px] text-ink-2">
              {count(Math.floor(progress * d.nPerArm * 2))} of {count(d.nPerArm * 2)} scored
            </div>
            <Progress value={progress} label={`${exp.id} progress`} className="mt-1.5" />
          </div>
        )}
      </header>

      <Section title="Question and hypothesis">
        <p className="text-ink-2">{inv.question}</p>
        {h && (
          <div className="mt-2 flex items-start gap-2">
            <Mono className="pt-px text-ink-3">{h.id}</Mono>
            <p className="flex-1">{h.text}</p>
            <VerdictTag verdict={verdictFor(inv, h).verdict} />
          </div>
        )}
      </Section>

      <Section title="Target">
        <Facts
          rows={[
            ["System", target ? <Link href="/systems" className="underline decoration-line-strong underline-offset-2 hover:decoration-ink">{target.name}</Link> : null],
            ["Model or build", target?.versionString ? <Mono>{target.versionString}</Mono> : null],
            ["Kind", target?.kind],
          ]}
        />
      </Section>

      <Section title="Dataset">
        <Facts
          rows={[
            ["Name", dataset ? <Mono>{dataset.name}</Mono> : null],
            ["Size", dataset ? `${count(dataset.size)} items` : null],
            ["Split", dataset?.split],
            ["Held out", dataset ? (dataset.heldOut === null ? null : dataset.heldOut ? "Yes" : "No") : null],
            ["Hash", dataset?.hash ? <Mono>{dataset.hash}</Mono> : null],
          ]}
        />
      </Section>

      <Section title="Control vs treatment">
        <ScrollRegion label="Control vs treatment settings" className="rounded-[6px] border border-line">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-ink-3">
                <th scope="col" className="px-2 py-1.5 font-normal">
                  Setting
                </th>
                <th scope="col" className="px-2 py-1.5 font-normal">
                  Control · {d.control.label}
                </th>
                <th scope="col" className="px-2 py-1.5 font-normal">
                  Treatment · {d.treatment.label}
                </th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {keys.map((k) => {
                const a = d.control.config[k];
                const b = d.treatment.config[k];
                const changed = a !== b;
                return (
                  <tr key={k} className={cn("border-b border-line last:border-0", changed && "bg-sunken")}>
                    <th scope="row" className="px-2 py-1.5 text-left font-normal text-ink-2">
                      {changed && <span className="sr-only">Changed: </span>}
                      {changed ? "± " : ""}
                      {k}
                    </th>
                    <td className="px-2 py-1.5">{a ?? "—"}</td>
                    <td className={cn("px-2 py-1.5", changed && "font-medium")}>{b ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollRegion>
      </Section>

      <Section title="Samples">
        <Facts
          rows={[
            ["Per arm", r ? `${count(r.control.n)} control · ${count(r.treatment.n)} treatment (planned ${count(d.nPerArm)})` : `${count(d.nPerArm)} planned`],
            ["Design", d.pairing === "paired" ? "Paired: same items in both arms" : "Independent arms"],
            ["Assignment", d.randomized === null ? null : d.randomized ? "Randomised" : "Not randomised"],
            ["Seed", d.seed !== null ? <Mono>{d.seed}</Mono> : null],
            ["Temperature", d.temperature !== null ? <Mono>{d.temperature}</Mono> : null],
          ]}
        />
      </Section>

      <Section title="Metric and scorer">
        <Facts
          rows={[
            ["Metric", d.metric.name],
            ["Definition", d.metric.definition],
            ["Scorer", `${d.scorer.name} (${d.scorer.kind === "rule" ? "rule" : d.scorer.kind === "judge" ? "model judge" : "human raters"})`],
            ["Judge family", d.scorer.kind === "judge" ? d.scorer.family : "Not applicable"],
            [
              "Judge–human agreement",
              d.scorer.kind === "rule" ? "Not applicable" : d.scorer.humanAgreement !== null ? <Mono>{d.scorer.humanAgreement.toFixed(2)}{d.scorer.humanAgreementN ? ` on ${d.scorer.humanAgreementN} items` : ""}</Mono> : null,
            ],
          ]}
        />
        {sameFamily && <p className="mt-2 text-[13px] text-warn">The judge and the target are in the same model family.</p>}
      </Section>

      <Section title="Effect">
        {r ? (
          <>
            <Facts
              rows={[
                [d.control.label, <Mono key="c">{formatPct(r.control.rate)} [{formatPct(r.control.ci[0])}, {formatPct(r.control.ci[1])}] · {r.control.k}/{r.control.n}</Mono>],
                [d.treatment.label, <Mono key="t">{formatPct(r.treatment.rate)} [{formatPct(r.treatment.ci[0])}, {formatPct(r.treatment.ci[1])}] · {r.treatment.k}/{r.treatment.n}</Mono>],
                ["Δ (treatment − control)", <Mono key="d">{formatPP(r.diff)}, 95% CI {formatCIpp(r.diffCI)} pp</Mono>],
                ["Cohen's h", <Mono key="h">{signed(r.cohensH)} ({effectSizeLabel(r.cohensH)})</Mono>],
              ]}
            />
            <p className="mt-2 text-[12px] text-ink-3">Rates with Wilson 95% intervals; Δ interval by {r.diffCIMethod.toLowerCase()}.</p>
            <PairedRates exp={exp} />
          </>
        ) : (
          <p className="text-ink-2">{exp.status === "running" ? "In progress, no result yet." : "No result yet."}</p>
        )}
        <Interpretation className="mt-4">{experimentInterpretation(exp)}</Interpretation>
      </Section>

      {r && (
        <Section title="Statistical analysis">
          <Facts
            rows={[
              ["Test", r.test],
              ["Statistic", <Mono key="s">{r.statistic}</Mono>],
              ["p", <Mono key="p">{formatP(r.p).replace("p ", "")}</Mono>],
              ["Effect size", <Mono key="e">h = {signed(r.cohensH)}</Mono>],
              [
                "Multiple comparisons",
                !d.primary ? "Secondary analysis, not corrected" : holm !== undefined && holmAdjusted(inv).size > 1 ? <Mono key="m">Holm-adjusted {formatP(holm).replace("p ", "p ")} across {holmAdjusted(inv).size} primary tests</Mono> : "Single primary test",
              ],
            ]}
          />
          {reps.length > 0 && (
            <div className="mt-3">
              <div className="text-[13px] text-ink-3">Replications</div>
              <ul className="mt-1 space-y-1">
                {reps.map(({ run: rr, r: rep }) => (
                  <li key={rr.id} className="font-mono text-[13px] text-ink-2">
                    {rep ? `Δ ${formatPP(rep.diff)} [${formatCIpp(rep.diffCI)}] · ${formatP(rep.p)}` : "Running…"}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}

      <Section title="Validity checks">
        {checks ? (
          <>
            <ul className="space-y-1.5">
              {checks.map((c) => (
                <li key={c.id} className="flex items-start gap-2 text-[13px]">
                  <CheckSymbol state={c.state} />
                  <span className="min-w-0">
                    <span className="text-ink">
                      {c.id} {c.label}
                    </span>
                    <span className="block text-ink-2">{c.reason}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[12px] text-ink-3">{RUBRIC_LABEL}</p>
          </>
        ) : (
          <p className="text-ink-2">Checks run when the experiment finishes.</p>
        )}
      </Section>

      <Section title="Evidence">
        {samples.length ? (
          <>
            <ul className="space-y-2">
              {samples.slice(0, 5).map((s) => (
                <li key={s.id} className="rounded-[6px] border border-line p-2.5 text-[13px]">
                  <div className="flex items-center gap-2 text-[12px] text-ink-3">
                    <span>{s.arm === "control" ? d.control.label : d.treatment.label}</span>
                    <span aria-hidden>·</span>
                    <span>{s.score ? d.metric.positiveLabel : d.metric.negativeLabel}</span>
                    {s.simulated && <SimulatedTag className="ml-auto" />}
                  </div>
                  <p className="mt-1 line-clamp-2 text-ink">{s.response}</p>
                </li>
              ))}
            </ul>
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => showEvidence(exp.id)}>
              Open all {samples.length} samples
            </Button>
          </>
        ) : (
          <p className="text-ink-2">No samples yet.</p>
        )}
      </Section>

      <Section title="Trace">
        {traced ? (
          <Button size="sm" variant="ghost" onClick={() => openTrace(traced.id)}>
            Open a trace
          </Button>
        ) : (
          <p className="text-ink-2">No trace recorded for this experiment.</p>
        )}
      </Section>

      <Section title="Reproducibility">
        <Facts
          rows={[
            ["Model version", run?.modelVersion ? <Mono>{run.modelVersion}</Mono> : null],
            ["Seed", d.seed !== null ? <Mono>{d.seed}</Mono> : null],
            ["Parameters", run?.params ? <Mono>{Object.entries(run.params).map(([k, v]) => `${k}=${v}`).join(" ")}</Mono> : null],
            ["Dataset hash", run?.datasetHash ? <Mono>{run.datasetHash}</Mono> : null],
            ["Config hash", run?.configHash ? <Mono>{run.configHash}</Mono> : null],
            ["Started", run ? <time dateTime={run.startedAt}>{absoluteTime(run.startedAt)}</time> : null],
            ["Finished", run?.finishedAt ? <time dateTime={run.finishedAt}>{absoluteTime(run.finishedAt)}</time> : run ? "Still running" : null],
            ["Duration", run?.finishedAt ? duration(Date.parse(run.finishedAt) - Date.parse(run.startedAt)) : null],
            ["Tokens", run?.tokens !== null && run?.tokens !== undefined ? count(run.tokens) : null],
            ["Cost", run?.costUsd !== null && run?.costUsd !== undefined ? `$${run.costUsd.toFixed(2)}` : null],
          ]}
        />
        <Button
          size="sm"
          className="mt-3"
          icon={<Copy strokeWidth={1.5} />}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(bundle());
              toast({ title: "Reproducibility bundle copied", body: `${exp.id} · JSON` });
            } catch {
              toast({ title: "Couldn't copy to the clipboard" });
            }
          }}
        >
          Copy reproducibility bundle (JSON)
        </Button>
        <p className="mt-2 text-[12px] text-ink-3">
          {exp.simulation === null ? "Recorded from a live run on a real model; every answer was scored by code." : `${provider.label}: runs are simulated by the demo provider.`}
        </p>
      </Section>
    </div>
  );
}
