import { analyzeExperiment, finishedExperiments, holmAdjusted, isLiveInvestigation, primaryRun, verdictFor } from "@/lib/data/derive";
import { experimentInterpretation, investigationInterpretation, strengthLine, VERDICT_LABEL } from "@/lib/data/interpret";
import type { Investigation } from "@/lib/data/types";
import { formatCIpp, formatP, formatPct, formatPP, signed } from "@/lib/stats";
import type { Assessment } from "@/lib/validity";
import { BRAND } from "@/lib/brand";

/** Limitations come from checks that did not pass, plus the researcher's own notes. */
export function limitations(inv: Investigation, a: Assessment): string[] {
  const out: string[] = [];
  a.perExperiment.forEach((p) =>
    p.checks
      ?.filter((c) => c.state === "fail" || c.state === "warn" || c.state === "unknown")
      .forEach((c) => out.push(`${p.exp.id}, ${c.label.toLowerCase()}: ${c.reason}.`)),
  );
  if (a.competing.state !== "pass") out.push(`${a.competing.label}: ${a.competing.reason}.`);
  return out;
}

export function reportMarkdown(inv: Investigation, a: Assessment, systemName: (id: string) => string, datasetName: (id: string | null) => string | null): string {
  const done = finishedExperiments(inv);
  const adj = holmAdjusted(inv);
  const L: string[] = [];
  L.push(`# ${inv.title}`, "");
  L.push(`${systemName(inv.systemId)} · generated ${new Date().toISOString().slice(0, 10)} · ${BRAND.name} (${isLiveInvestigation(inv) ? "live run on a real model, scored by code" : "demo data, simulated runs"})`, "");
  if (done.length) {
    L.push("## Summary", "", `**${strengthLine(a)}**`, "", `_Interpretation:_ ${investigationInterpretation(inv)}`, "");
  }
  L.push("## Question", "", inv.question, "");
  const ran = inv.experiments.filter((e) => e.status !== "proposed");
  if (ran.length) {
    L.push("## Method", "");
    ran.forEach((e) => {
      const d = e.design;
      L.push(
        `- **${e.id} ${e.title}** (${e.hypothesisId}). Dataset: ${datasetName(d.datasetId) ?? "not recorded"}. Arms: ${d.control.label} vs ${d.treatment.label}. ${d.nPerArm} per arm planned, ${d.pairing}. Scorer: ${d.scorer.name} (${d.scorer.kind}). Metric: ${d.metric.definition}.`,
      );
    });
    L.push("");
  }
  if (done.length) {
    L.push("## Results", "", "| Experiment | Control | Treatment | Δ (pp) | 95% CI (pp) | Test | p | Holm p | h |", "|---|---|---|---|---|---|---|---|---|");
    done.forEach((e) => {
      const r = analyzeExperiment(e)!;
      const h = adj.get(e.id);
      L.push(
        `| ${e.id} ${e.title} | ${formatPct(r.control.rate)} (${r.control.k}/${r.control.n}) | ${formatPct(r.treatment.rate)} (${r.treatment.k}/${r.treatment.n}) | ${formatPP(r.diff).replace(" pp", "")} | ${formatCIpp(r.diffCI)} | ${r.test} | ${formatP(r.p).replace("p ", "")} | ${h !== undefined ? formatP(h).replace("p ", "") : "—"} | ${signed(r.cohensH)} |`,
      );
    });
    L.push("");
    done.forEach((e) => L.push(`_${e.id}:_ ${experimentInterpretation(e)}`, ""));
  }
  const competing = inv.hypotheses.filter((h) => h.competing && verdictFor(inv, h).verdict !== "untested");
  if (competing.length) {
    L.push("## Alternative explanations", "");
    competing.forEach((h) => L.push(`- ${h.id}: ${h.text} Verdict: ${VERDICT_LABEL[verdictFor(inv, h).verdict].toLowerCase()}.`));
    L.push("");
  }
  const lim = limitations(inv, a);
  if (lim.length || inv.notes.trim()) {
    L.push("## Limitations", "");
    lim.forEach((x) => L.push(`- ${x}`));
    if (inv.notes.trim()) L.push(`- Researcher's note: ${inv.notes.trim()}`);
    L.push("");
  }
  if (done.length) {
    L.push("## Reproducibility", "");
    done.forEach((e) => {
      const run = primaryRun(e)!;
      L.push(
        `- ${e.id}: model ${run.modelVersion ?? "not recorded"}; seed ${e.design.seed ?? "not recorded"}; dataset ${run.datasetHash ?? "hash not recorded"}; config ${run.configHash ?? "not recorded"}; run ${run.startedAt} to ${run.finishedAt}.`,
      );
    });
    L.push("");
  }
  const proposed = inv.experiments.filter((e) => e.status === "proposed");
  const unrep = done.filter((e) => !e.runs.some((r) => r.role === "replication"));
  if (proposed.length || unrep.length) {
    L.push("## Next experiments", "");
    proposed.forEach((e) => L.push(`- Run ${e.id} ${e.title} (proposed).`));
    unrep.forEach((e) => L.push(`- Replicate ${e.id} with a new seed.`));
    L.push("");
  }
  return L.join("\n");
}

export function reportJSON(inv: Investigation, a: Assessment): string {
  const results = finishedExperiments(inv).map((e) => {
    const r = analyzeExperiment(e)!;
    return {
      experiment: e.id,
      control: { k: r.control.k, n: r.control.n, rate: r.control.rate, wilson95: r.control.ci },
      treatment: { k: r.treatment.k, n: r.treatment.n, rate: r.treatment.rate, wilson95: r.treatment.ci },
      diff: r.diff,
      diffCI95: r.diffCI,
      diffCIMethod: r.diffCIMethod,
      test: r.test,
      statistic: r.statistic,
      p: r.p,
      holmP: holmAdjusted(inv).get(e.id) ?? null,
      cohensH: r.cohensH,
    };
  });
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      source: `${BRAND.name} demo data (simulated runs)`,
      investigation: inv,
      derived: {
        strength: a.strength,
        result: a.result,
        checks: a.perExperiment.map((p) => ({ experiment: p.exp.id, strength: p.strength, checks: p.checks })),
        competing: a.competing,
        results,
      },
    },
    null,
    2,
  );
}
