"use client";

import { ScrollRegion } from "@/components/ui/primitives";
import { useState } from "react";
import { ForestPlot, Curve, Heatmap } from "@/components/charts/Charts";
import { provider, systemName } from "@/lib/data";
import { analyzeExperiment, finishedExperiments, holmAdjusted, isLiveInvestigation, primaryRun, verdictFor } from "@/lib/data/derive";
import { experimentInterpretation, investigationInterpretation, strengthLine, VERDICT_LABEL } from "@/lib/data/interpret";
import { count, longDate } from "@/lib/format";
import { formatCIpp, formatP, formatPct, formatPP, signed } from "@/lib/stats";
import { RUBRIC_LABEL } from "@/lib/validity";
import { Mono } from "./common";
import { useWS } from "./context";
import { limitations } from "./report-export";

function H2({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-10 font-serif text-[22px] font-normal leading-[30px] text-ink">{children}</h3>;
}

/**
 * The report: serif, print-ready. Every section appears only when the data
 * backs it; nothing is claimed that is not a stored field or derived from one.
 * The page's single <h1> is the investigation title above the tabs.
 */
export function ReportTab() {
  const { inv, assessment } = useWS();
  const done = finishedExperiments(inv);
  const ran = inv.experiments.filter((e) => e.status !== "proposed");
  const adj = holmAdjusted(inv);
  const competing = inv.hypotheses.filter((h) => h.competing && verdictFor(inv, h).verdict !== "untested");
  const lim = limitations(inv, assessment);
  const proposed = inv.experiments.filter((e) => e.status === "proposed");
  const unrep = done.filter((e) => !e.runs.some((r) => r.role === "replication"));
  const grid = done.find((e) => e.design.grid);
  const [notes, setNotes] = useState(inv.notes);

  return (
    <article className="mx-auto max-w-[760px] pb-16 text-[16px] leading-[26px] text-ink">
      <header>
        {/* The screen already shows the title as the page's h1; paper needs its own. */}
        <p className="hidden font-serif text-[30px] leading-[38px] print:block" aria-hidden>
          {inv.title}
        </p>
        <p className="text-[13px] leading-5 text-ink-3 print:mt-2">
          {systemName(inv.systemId)} · report generated from the data on <time dateTime={inv.updatedAt}>{longDate(inv.updatedAt)}</time> ·{" "}
          {isLiveInvestigation(inv) ? "live run on a real model, scored by code" : `${provider.label}, simulated runs`}
        </p>
      </header>

      {done.length > 0 && (
        <section>
          <H2>Summary</H2>
          <p className="mt-2 font-medium">{strengthLine(assessment)}</p>
          <p className="mt-1 text-[12px] text-ink-3">Interpretation</p>
          <p className="font-serif">{investigationInterpretation(inv)}</p>
        </section>
      )}

      <section>
        <H2>Question</H2>
        <p className="mt-2 font-serif">{inv.question}</p>
      </section>

      {ran.length > 0 && (
        <section>
          <H2>Method</H2>
          <ul className="mt-2 space-y-3">
            {ran.map((e) => {
              const d = e.design;
              const ds = d.datasetId ? provider.getDataset(d.datasetId) : undefined;
              return (
                <li key={e.id}>
                  <span className="font-medium">
                    {e.id} {e.title}
                  </span>{" "}
                  <span className="text-ink-2">
                    ({e.hypothesisId}). Dataset {ds ? `${ds.name} (${count(ds.size)} items${ds.heldOut ? ", held out" : ""})` : "not recorded"}. {d.control.label} vs{" "}
                    {d.treatment.label}, {d.nPerArm} per arm planned, {d.pairing === "paired" ? "paired" : "independent arms"}. Scored by {d.scorer.name} ({d.scorer.kind}):{" "}
                    {d.metric.definition.charAt(0).toLowerCase() + d.metric.definition.slice(1)}.
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {done.length > 0 && (
        <section>
          <H2>Results</H2>
          <div className="mt-3 space-y-4 font-sans text-[14px] leading-5">
            <ForestPlot inv={inv} experiments={done} />
            <ScrollRegion label="Results table">
              <table className="w-full min-w-[620px] text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left text-ink-3">
                    <th scope="col" className="py-1.5 pr-3 font-normal">Experiment</th>
                    <th scope="col" className="py-1.5 pr-3 text-right font-normal">Control</th>
                    <th scope="col" className="py-1.5 pr-3 text-right font-normal">Treatment</th>
                    <th scope="col" className="py-1.5 pr-3 text-right font-normal">Δ (pp)</th>
                    <th scope="col" className="py-1.5 pr-3 text-right font-normal">95% CI (pp)</th>
                    <th scope="col" className="py-1.5 pr-3 font-normal">Test</th>
                    <th scope="col" className="py-1.5 pr-3 text-right font-normal">p</th>
                    <th scope="col" className="py-1.5 text-right font-normal">h</th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular">
                  {done.map((e) => {
                    const r = analyzeExperiment(e)!;
                    const h = adj.get(e.id);
                    return (
                      <tr key={e.id} className="border-b border-line last:border-0">
                        <td className="py-1.5 pr-3 font-sans">
                          {e.id} {e.title}
                        </td>
                        <td className="py-1.5 pr-3 text-right">{formatPct(r.control.rate)}</td>
                        <td className="py-1.5 pr-3 text-right">{formatPct(r.treatment.rate)}</td>
                        <td className="py-1.5 pr-3 text-right">{formatPP(r.diff).replace(" pp", "")}</td>
                        <td className="py-1.5 pr-3 text-right">{formatCIpp(r.diffCI)}</td>
                        <td className="py-1.5 pr-3 font-sans">{r.test}</td>
                        <td className="py-1.5 pr-3 text-right" title={h !== undefined ? `Holm-adjusted ${formatP(h)}` : undefined}>
                          {formatP(r.p).replace("p = ", "").replace("p ", "")}
                          {h !== undefined && adj.size > 1 && <span className="text-ink-3"> (Holm {formatP(h).replace("p = ", "").replace("p ", "")})</span>}
                        </td>
                        <td className="py-1.5 text-right">{signed(r.cohensH)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollRegion>
            <Curve inv={inv} />
            {grid && <Heatmap exp={grid} />}
          </div>
          <div className="mt-4 space-y-3">
            {done.map((e) => (
              <p key={e.id} className="font-serif">
                <span className="font-sans text-[12px] text-ink-3">Interpretation · {e.id} </span>
                {experimentInterpretation(e)}
              </p>
            ))}
          </div>
        </section>
      )}

      {competing.length > 0 && (
        <section>
          <H2>Alternative explanations</H2>
          <ul className="mt-2 space-y-2">
            {competing.map((h) => (
              <li key={h.id}>
                <Mono className="text-ink-3">{h.id}</Mono> {h.text} <span className="text-ink-2">Verdict: {VERDICT_LABEL[verdictFor(inv, h).verdict].toLowerCase()}.</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(lim.length > 0 || done.length > 0) && (
        <section>
          <H2>Limitations</H2>
          {lim.length > 0 && (
            <>
              <p className="mt-2 text-[13px] text-ink-3">From the validity checks ({RUBRIC_LABEL}):</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {lim.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </>
          )}
          <label htmlFor="report-notes" className="no-print mt-4 block text-[13px] text-ink-3">
            Your own limitations and notes
          </label>
          <textarea
            id="report-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => provider.setNotes(inv.id, notes)}
            rows={3}
            maxLength={4000}
            placeholder="Anything a reader should know that the checks cannot see…"
            className="no-print mt-1 w-full rounded-[10px] border border-line-field bg-surface p-3 font-sans text-[14px] leading-5 text-ink placeholder:text-ink-3"
          />
          {notes.trim() && <p className="mt-2 hidden whitespace-pre-line print:block">{notes}</p>}
        </section>
      )}

      {done.length > 0 && (
        <section>
          <H2>Reproducibility</H2>
          <ul className="mt-2 space-y-2 font-sans text-[13px] leading-5">
            {done.map((e) => {
              const run = primaryRun(e)!;
              return (
                <li key={e.id}>
                  <span className="font-medium">{e.id}</span>{" "}
                  <Mono className="text-ink-2">
                    model {run.modelVersion ?? "not recorded"} · seed {e.design.seed ?? "not recorded"} · dataset {run.datasetHash ?? "hash not recorded"} · config{" "}
                    {run.configHash ?? "not recorded"}
                  </Mono>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {(proposed.length > 0 || unrep.length > 0) && (
        <section>
          <H2>Next experiments</H2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {proposed.map((e) => (
              <li key={e.id}>
                Run {e.id} {e.title} ({e.design.control.label} vs {e.design.treatment.label}).
              </li>
            ))}
            {unrep.map((e) => (
              <li key={`r-${e.id}`}>Replicate {e.id} with a new seed.</li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
