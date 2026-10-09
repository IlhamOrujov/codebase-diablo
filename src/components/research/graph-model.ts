/**
 * The research graph as layers, top to bottom, answering six questions:
 * what did we investigate (Question), what did we believe (Hypotheses), what
 * did we test (Experiments), what evidence did we collect (Evidence), why do
 * we believe the conclusion (Conclusion), what next (Next).
 */
import { analyzeExperiment, finishedExperiments, verdictFor, type Verdict } from "@/lib/data/derive";
import { strengthLine } from "@/lib/data/interpret";
import type { ExperimentStatus, Investigation } from "@/lib/data/types";
import { formatCIpp, formatPP } from "@/lib/stats";
import type { Assessment } from "@/lib/validity";

export const LAYERS = ["Question", "Hypotheses", "Experiments", "Evidence", "Conclusion", "Next"] as const;

export type NodeKind = "question" | "hypothesis" | "experiment" | "evidence" | "conclusion" | "next" | "more";

export interface GNode {
  id: string;
  layer: number;
  kind: NodeKind;
  /** Small header line, e.g. "H1 · Supported". */
  head: string;
  text: string;
  /** Mono detail line (results). */
  mono?: string;
  parents: string[];
  status?: ExperimentStatus;
  verdict?: Verdict;
  /** Experiment this node opens. */
  ref?: string;
  dashed?: boolean;
  /** For "+N more" nodes: the layer they expand. */
  expands?: number;
}

const MAX_PER_LAYER = 12;

export function buildGraph(inv: Investigation, assessment: Assessment, expanded: Set<number>): GNode[] {
  const nodes: GNode[] = [];
  nodes.push({ id: "Q", layer: 0, kind: "question", head: "Question", text: inv.question, parents: [] });

  inv.hypotheses.forEach((h) => {
    const v = verdictFor(inv, h).verdict;
    nodes.push({
      id: h.id,
      layer: 1,
      kind: "hypothesis",
      head: `${h.id}${h.competing ? " · competing" : ""}`,
      text: h.text,
      parents: ["Q"],
      verdict: v,
      ref: h.id,
    });
  });

  // Experiments ordered by hypothesis to keep edges from crossing.
  const order = new Map(inv.hypotheses.map((h, i) => [h.id, i]));
  const exps = [...inv.experiments].sort((a, b) => (order.get(a.hypothesisId) ?? 99) - (order.get(b.hypothesisId) ?? 99));
  exps.forEach((e) =>
    nodes.push({
      id: e.id,
      layer: 2,
      kind: "experiment",
      head: e.id,
      text: e.title,
      parents: [e.hypothesisId],
      status: e.status,
      ref: e.id,
      dashed: e.status === "proposed",
    }),
  );

  const done = finishedExperiments(inv);
  const doneSorted = exps.filter((e) => done.includes(e));
  doneSorted.forEach((e) => {
    const r = analyzeExperiment(e)!;
    nodes.push({
      id: `ev-${e.id}`,
      layer: 3,
      kind: "evidence",
      head: `${e.id} evidence`,
      text: r.effectFound ? "Effect found" : "No clear effect",
      mono: `n = ${r.control.n + r.treatment.n} · Δ ${formatPP(r.diff)} [${formatCIpp(r.diffCI)}]`,
      parents: [e.id],
      ref: e.id,
    });
  });

  const conclusionParents = doneSorted.length ? doneSorted.map((e) => `ev-${e.id}`) : inv.hypotheses.map((h) => h.id);
  nodes.push({
    id: "C",
    layer: 4,
    kind: "conclusion",
    head: "Conclusion",
    text: strengthLine(assessment),
    parents: conclusionParents,
  });

  const next: GNode[] = [];
  done
    .filter((e) => !e.runs.some((r) => r.role === "replication"))
    .forEach((e) => next.push({ id: `next-rep-${e.id}`, layer: 5, kind: "next", head: "Next", text: `Replicate ${e.id} with a new seed`, parents: ["C"], ref: e.id, dashed: true }));
  inv.experiments
    .filter((e) => e.status === "proposed")
    .forEach((e) => next.push({ id: `next-run-${e.id}`, layer: 5, kind: "next", head: "Next", text: `Run ${e.id} · ${e.title}`, parents: ["C"], ref: e.id, dashed: true }));
  if (assessment.competing.state !== "pass")
    next.push({ id: "next-c9", layer: 5, kind: "next", head: "Next", text: "State and test a competing explanation", parents: ["C"], dashed: true });
  nodes.push(...next);

  // Collapse crowded layers into "+N more".
  const out: GNode[] = [];
  for (let layer = 0; layer < LAYERS.length; layer++) {
    const inLayer = nodes.filter((n) => n.layer === layer);
    if (inLayer.length > MAX_PER_LAYER && !expanded.has(layer)) {
      const shown = inLayer.slice(0, MAX_PER_LAYER - 1);
      out.push(...shown);
      out.push({
        id: `more-${layer}`,
        layer,
        kind: "more",
        head: "",
        text: `+${inLayer.length - shown.length} more`,
        parents: [],
        expands: layer,
      });
    } else out.push(...inLayer);
  }
  // Drop parent links to hidden nodes.
  const ids = new Set(out.map((n) => n.id));
  return out.map((n) => ({ ...n, parents: n.parents.filter((p) => ids.has(p)) }));
}

export const NODE_W: Record<NodeKind, number> = {
  question: 360,
  hypothesis: 220,
  experiment: 200,
  evidence: 220,
  conclusion: 300,
  next: 200,
  more: 120,
};

export interface Placed extends GNode {
  x: number;
  y: number;
  w: number;
  h: number;
}

const GAP_X = 24;
const GAP_Y = 56;
export const LABEL_W = 96;

/** Estimate a node's height before it is measured (13px text, ~7px per character). */
export function estimateHeight(n: GNode): number {
  const w = NODE_W[n.kind] - 24;
  const lines = Math.max(1, Math.ceil((n.text.length * 7) / w));
  return 20 + 18 + lines * 18 + (n.mono ? 18 : 0);
}

export function layout(nodes: GNode[], heights: Record<string, number>): { placed: Placed[]; width: number; height: number; layerY: number[] } {
  const layers = LAYERS.map((_, i) => nodes.filter((n) => n.layer === i));
  const widths = layers.map((l) => l.reduce((s, n) => s + NODE_W[n.kind], 0) + Math.max(0, l.length - 1) * GAP_X);
  const width = Math.max(...widths, 400) + LABEL_W + 48;
  const placed: Placed[] = [];
  const layerY: number[] = [];
  let y = 24;
  layers.forEach((l, i) => {
    layerY.push(y);
    if (!l.length) return;
    let x = LABEL_W + 24 + (width - LABEL_W - 48 - widths[i]) / 2;
    let maxH = 0;
    l.forEach((n) => {
      const w = NODE_W[n.kind];
      const h = heights[n.id] ?? estimateHeight(n);
      placed.push({ ...n, x, y, w, h });
      x += w + GAP_X;
      maxH = Math.max(maxH, h);
    });
    y += maxH + GAP_Y;
  });
  return { placed, width, height: y - GAP_Y + 24, layerY };
}

/** Ancestors and descendants of a node: its lineage. */
export function lineage(nodes: GNode[], id: string): Set<string> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out = new Set<string>([id]);
  const up = (nid: string) => byId.get(nid)?.parents.forEach((p) => (out.has(p) ? null : (out.add(p), up(p))));
  const down = (nid: string) =>
    nodes.filter((n) => n.parents.includes(nid)).forEach((c) => (out.has(c.id) ? null : (out.add(c.id), down(c.id))));
  up(id);
  down(id);
  return out;
}
