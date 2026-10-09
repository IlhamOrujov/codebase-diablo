// derive.ts: из counts одного Run — тест, Δ, CI, p. Статистику проект не хранит, а пересчитывает.
import { analyzeRun } from "@/lib/data/derive";
import type { Run } from "@/lib/data/types";
import { formatCIpp, formatP, formatPP } from "@/lib/stats";

const run: Run = {
  id: "inv-1/E1/primary-1", experimentId: "E1", role: "primary",
  startedAt: "2026-10-09T10:00:00.000Z", finishedAt: "2026-10-09T10:02:00.000Z", expectedDurationMs: 120_000,
  counts: { control: { k: 69, n: 80 }, treatment: { k: 57, n: 80 } },   // единственное, что пишет runner
  discordant: { b: 16, c: 4 },                                          // paired: те же 80 items
  sweep: null, grid: null, modelVersion: "glm-4.7-flash", params: { seed: "42" },
  datasetHash: null, configHash: null, tokens: null, costUsd: 0, samples: [], traces: [],
};
for (const pairing of ["paired", "independent"] as const) {
  const r = analyzeRun(run, pairing)!;
  console.log(pairing.padEnd(11), r.test.padEnd(22), "Δ", formatPP(r.diff), "CI", formatCIpp(r.diffCI), formatP(r.p), "| effectFound:", r.effectFound);
}
