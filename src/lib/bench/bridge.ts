/**
 * Turns simulated counts into the app's own data model, so the benchmark can
 * run Diablo's real analysis code (derive.ts) on them: `analyzeRun` for the
 * paired bootstrap CI, `holmAdjusted` for the correction across experiments.
 */
import type { Experiment, Hypothesis, Investigation, Run } from "@/lib/data/types";
import { cellKey, type PairedCounts, type SimulatedData } from "./scenario";

const AT = "2026-10-09T00:00:00.000Z";

/** A finished paired run with these counts. */
export function toRun(id: string, e: PairedCounts): Run {
  return {
    id,
    experimentId: id,
    role: "primary",
    startedAt: AT,
    finishedAt: AT,
    expectedDurationMs: 0,
    counts: { control: { k: e.kControl, n: e.n }, treatment: { k: e.kTreatment, n: e.n } },
    discordant: { b: e.b, c: e.c },
    sweep: null,
    grid: null,
    modelVersion: null,
    params: null,
    datasetHash: null,
    configHash: null,
    tokens: null,
    costUsd: null,
    samples: [],
    traces: [],
  };
}

/** Run id for factor j's experiment in a replicate; its hash seeds the bootstrap, as in the app. */
export function experimentRunId(data: SimulatedData, rep: number, j: number): string {
  return `${cellKey(data.scenario.cell, rep)}/E${j + 1}`;
}

/**
 * The investigation Diablo would hold for this scenario: one hypothesis per
 * factor ("changing it lowered accuracy") and one primary, paired experiment
 * per hypothesis, finished, with the simulated counts.
 */
export function toInvestigation(data: SimulatedData, rep: number): Investigation {
  const { scenario } = data;
  const hypotheses: Hypothesis[] = scenario.factors.map((f, j) => ({
    id: `H${j + 1}`,
    text: `Changing the ${f} lowered accuracy`,
    prediction: "decrease",
    competing: j > 0,
  }));
  const experiments: Experiment[] = data.experiments.map((e, j) => {
    const run = toRun(experimentRunId(data, rep, j), e);
    return {
      id: `E${j + 1}`,
      title: `v1 with only the ${scenario.factors[j]} changed`,
      hypothesisId: `H${j + 1}`,
      status: "complete",
      design: {
        datasetId: null,
        control: { label: "v1", systemId: "bench-v1", config: {} },
        treatment: { label: `v1 + ${scenario.factors[j]}`, systemId: "bench-v1", config: {} },
        metric: {
          name: "Accuracy",
          definition: "Item answered correctly",
          positiveLabel: "Correct",
          negativeLabel: "Incorrect",
          higherIs: "better",
        },
        scorer: { kind: "rule", name: "Simulated", family: null, humanAgreement: null, humanAgreementN: null },
        nPerArm: e.n,
        seed: scenario.seed,
        randomized: true,
        pairing: "paired",
        temperature: null,
        primary: true,
        sweep: null,
        grid: null,
      },
      runs: [run],
      createdAt: AT,
      updatedAt: AT,
      simulation: null,
    };
  });
  return {
    id: cellKey(scenario.cell, rep),
    title: "Which change caused the drop?",
    question: "Which change caused the drop?",
    systemId: "bench-v1",
    createdAt: AT,
    updatedAt: AT,
    hypotheses,
    experiments,
    events: [],
    notes: "",
    pinned: false,
    templateDraft: false,
    failed: false,
  };
}
