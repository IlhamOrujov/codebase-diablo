"use client";

import { analyzeExperiment, analyzeRun, primaryRun, type RunResult } from "@/lib/data/derive";
import type { Experiment, Investigation } from "@/lib/data/types";
import { formatCIpp, formatP, formatPct, formatPP, num, wilson } from "@/lib/stats";
import { count } from "@/lib/format";
import { ChartFrame, fit, scale, ticks, useWidth } from "./ChartFrame";

const ROW = 34;
const FONT = 13;

/* ── Forest plot: Δ (pp) with 95% CI for every finished experiment ── */

export function ForestPlot({ inv, experiments }: { inv: Investigation; experiments: Experiment[] }) {
  const rows = experiments
    .map((e) => ({ e, r: analyzeExperiment(e) }))
    .filter((x): x is { e: Experiment; r: RunResult } => x.r !== null);
  const [ref, width] = useWidth<HTMLDivElement>();
  if (!rows.length) return null;

  const lo = Math.min(0, ...rows.map((x) => x.r.diffCI[0] * 100));
  const hi = Math.max(0, ...rows.map((x) => x.r.diffCI[1] * 100));
  const d0 = Math.floor((lo - 1) / 5) * 5;
  const d1 = Math.ceil((hi + 1) / 5) * 5;
  const step = d1 - d0 > 60 ? 10 : 5;
  const W = Math.max(280, width);
  const labelW = Math.min(240, Math.round(W * 0.36));
  const nW = W < 420 ? 0 : 76;
  const pad = 12;
  const x = scale(d0, d1, labelW + pad, W - nW - pad);
  const top = 22;
  const H = top + rows.length * ROW + 46;
  const totalN = rows.reduce((s, x) => s + x.r.control.n + x.r.treatment.n, 0);
  const effects = rows.filter((x) => x.r.effectFound).length;

  return (
    <ChartFrame
      title="Effect by experiment"
      takeaway={`${effects} of ${rows.length} finished experiment${rows.length > 1 ? "s" : ""} show${rows.length === 1 ? "s" : ""} an effect whose 95% CI excludes zero.`}
      units="Δ in percentage points (pp), treatment − control; whiskers are 95% CIs."
      source={`n = ${count(totalN)} scored responses · ${inv.title}`}
      fileName={`${inv.id}-forest`}
      table={{
        columns: ["Experiment", "Δ (pp)", "95% CI (pp)", "p", "n"],
        rows: rows.map(({ e, r }) => [
          `${e.id} ${e.title}`,
          num(r.diff * 100),
          formatCIpp(r.diffCI),
          formatP(r.p).replace("p ", ""),
          r.control.n + r.treatment.n,
        ]),
      }}
    >
      {({ titleId, descId }) => (
        <div ref={ref} className="w-full">
          {width > 0 && (
            <svg width={W} height={H} role="img" aria-labelledby={`${titleId} ${descId}`} className="block font-sans">
              {/* ticks and grid */}
              {ticks(d0, d1, step).map((t) => (
                <g key={t}>
                  <line x1={x(t)} x2={x(t)} y1={top - 6} y2={top + rows.length * ROW} stroke="var(--line)" />
                  <text x={x(t)} y={top + rows.length * ROW + 16} textAnchor="middle" fontSize={12} fill="var(--ink-3)" className="tabular">
                    {num(t, 0)}
                  </text>
                </g>
              ))}
              {/* zero line, labelled */}
              <line x1={x(0)} x2={x(0)} y1={top - 10} y2={top + rows.length * ROW} stroke="var(--ink-3)" strokeWidth={1} />
              <text x={x(0)} y={top - 12} textAnchor="middle" fontSize={12} fill="var(--ink-3)">
                no difference
              </text>
              {rows.map(({ e, r }, i) => {
                const cy = top + i * ROW + ROW / 2;
                const label = `${e.id} · ${e.title}`;
                return (
                  <g key={e.id}>
                    <text x={0} y={cy + 4} fontSize={FONT} fill="var(--ink)">
                      <title>{label}</title>
                      {fit(label, labelW - 8)}
                    </text>
                    <line x1={x(r.diffCI[0] * 100)} x2={x(r.diffCI[1] * 100)} y1={cy} y2={cy} stroke="var(--chart-2)" strokeWidth={2} />
                    <line x1={x(r.diffCI[0] * 100)} x2={x(r.diffCI[0] * 100)} y1={cy - 5} y2={cy + 5} stroke="var(--chart-2)" strokeWidth={1.5} />
                    <line x1={x(r.diffCI[1] * 100)} x2={x(r.diffCI[1] * 100)} y1={cy - 5} y2={cy + 5} stroke="var(--chart-2)" strokeWidth={1.5} />
                    <rect x={x(r.diff * 100) - 4} y={cy - 4} width={8} height={8} fill="var(--chart-2)" />
                    {nW > 0 && (
                      <text x={W} y={cy + 4} textAnchor="end" fontSize={12} fill="var(--ink-2)" className="tabular" fontFamily="var(--font-mono)">
                        n = {count(r.control.n + r.treatment.n)}
                      </text>
                    )}
                  </g>
                );
              })}
              <text x={(x(d0) + x(d1)) / 2} y={H - 6} textAnchor="middle" fontSize={12} fill="var(--ink-2)">
                {W < 520 ? "Δ, treatment − control (pp)" : "Δ rate, treatment − control, percentage points"}
              </text>
            </svg>
          )}
        </div>
      )}
    </ChartFrame>
  );
}

/* ── Paired rates: control and treatment with Wilson 95% CIs ───── */

export function PairedRates({ exp }: { exp: Experiment }) {
  const r = analyzeExperiment(exp);
  const [ref, width] = useWidth<HTMLDivElement>();
  if (!r) return null;
  const arms = [
    { label: exp.design.control.label, a: r.control, color: "var(--chart-1)" },
    { label: exp.design.treatment.label, a: r.treatment, color: "var(--chart-2)" },
  ];
  const lo = Math.max(0, Math.floor((Math.min(r.control.ci[0], r.treatment.ci[0]) * 100 - 5) / 10) * 10);
  const hi = Math.min(100, Math.ceil((Math.max(r.control.ci[1], r.treatment.ci[1]) * 100 + 5) / 10) * 10);
  const W = Math.max(260, width);
  const labelW = Math.min(170, Math.round(W * 0.34));
  const x = scale(lo, hi, labelW + 10, W - 12);
  const top = 8;
  const H = top + 2 * ROW + 40;
  const m = exp.design.metric.name;
  return (
    <ChartFrame
      title={`${m} by arm`}
      takeaway={`${exp.design.treatment.label} ${formatPct(r.treatment.rate)} vs ${exp.design.control.label} ${formatPct(r.control.rate)}: Δ ${formatPP(r.diff)}.`}
      units="Rate in percent; whiskers are Wilson 95% CIs."
      source={`n = ${count(r.control.n)} control, ${count(r.treatment.n)} treatment · ${exp.id}`}
      fileName={`${exp.id}-rates`}
      table={{
        columns: ["Arm", "k", "n", "Rate", "Wilson 95% CI"],
        rows: arms.map(({ label, a }) => [label, a.k, a.n, formatPct(a.rate), `${formatPct(a.ci[0])} to ${formatPct(a.ci[1])}`]),
      }}
    >
      {({ titleId, descId }) => (
        <div ref={ref} className="w-full">
          {width > 0 && (
            <svg width={W} height={H} role="img" aria-labelledby={`${titleId} ${descId}`} className="block font-sans">
              {ticks(lo, hi, hi - lo > 40 ? 20 : 10).map((t) => (
                <g key={t}>
                  <line x1={x(t)} x2={x(t)} y1={top} y2={top + 2 * ROW} stroke="var(--line)" />
                  <text x={x(t)} y={top + 2 * ROW + 16} textAnchor="middle" fontSize={12} fill="var(--ink-3)">
                    {t}%
                  </text>
                </g>
              ))}
              {arms.map(({ label, a, color }, i) => {
                const cy = top + i * ROW + ROW / 2;
                return (
                  <g key={label}>
                    <text x={0} y={cy + 4} fontSize={FONT} fill="var(--ink)">
                      <title>{label}</title>
                      {fit(label, labelW - 6)}
                    </text>
                    <line x1={x(a.ci[0] * 100)} x2={x(a.ci[1] * 100)} y1={cy} y2={cy} stroke={color} strokeWidth={2} />
                    <circle cx={x(a.rate * 100)} cy={cy} r={4.5} fill={color} />
                  </g>
                );
              })}
              <text x={(x(lo) + x(hi)) / 2} y={H - 4} textAnchor="middle" fontSize={12} fill="var(--ink-2)">
                {m}, percent
              </text>
            </svg>
          )}
        </div>
      )}
    </ChartFrame>
  );
}

/* ── Curve: a rate over an ordered variable, with a CI band, up to 2 series ── */

type Series = { label: string; points: { x: number; k: number; n: number }[]; color: string };

export function sweepSeries(inv: Investigation): { variable: string; unit: string; series: Series[]; exps: Experiment[] } | null {
  const swept = inv.experiments.filter((e) => e.design.sweep && primaryRun(e)?.sweep);
  if (!swept.length) return null;
  const variable = swept[0].design.sweep!.variable;
  const same = swept.filter((e) => e.design.sweep!.variable === variable).slice(0, 2);
  return {
    variable,
    unit: swept[0].design.sweep!.unit,
    exps: same,
    series: same.map((e, i) => ({
      label: e.design.sweep!.seriesLabel,
      points: primaryRun(e)!.sweep!,
      color: i === 0 ? "var(--chart-1)" : "var(--chart-2)",
    })),
  };
}

export function Curve({ inv }: { inv: Investigation }) {
  const data = sweepSeries(inv);
  const [ref, width] = useWidth<HTMLDivElement>();
  if (!data) return null;
  const { series, variable, unit, exps } = data;
  const levels = Array.from(new Set(series.flatMap((s) => s.points.map((p) => p.x)))).sort((a, b) => a - b);
  const metric = exps[0].design.metric.name;
  const allCI = series.flatMap((s) => s.points.map((p) => wilson(p.k, p.n)));
  const yMax = Math.min(100, Math.ceil((Math.max(...allCI.map((c) => c[1])) * 100 + 2) / 5) * 5);
  const yMin = Math.max(0, Math.floor((Math.min(...allCI.map((c) => c[0])) * 100 - 2) / 5) * 5);
  const W = Math.max(280, width);
  const left = 44;
  const right = 12;
  const top = series.length > 1 ? 28 : 12;
  const H = 240;
  const bottom = 44;
  const xi = scale(0, Math.max(1, levels.length - 1), left + 10, W - right - 10);
  const xOf = (v: number) => xi(levels.indexOf(v));
  const y = scale(yMin, yMax, H - bottom, top);
  const yStep = yMax - yMin > 40 ? 20 : yMax - yMin > 15 ? 5 : 2;
  const n = series.reduce((s, x) => s + x.points.reduce((a, p) => a + p.n, 0), 0);
  const first = series[0].points;
  const firstRate = first[0].k / first[0].n;
  const lastRate = first[first.length - 1].k / first[first.length - 1].n;

  return (
    <ChartFrame
      title={`${metric} by ${variable.toLowerCase()}`}
      takeaway={`${series[0].label}: ${formatPct(firstRate)} at ${levels[0]} ${unit}${levels[0] === 1 ? "" : "s"} to ${formatPct(lastRate)} at ${levels[levels.length - 1]}.${
        series[1]
          ? ` ${series[1].label}: ${formatPct(series[1].points[0].k / series[1].points[0].n)} to ${formatPct(
              series[1].points[series[1].points.length - 1].k / series[1].points[series[1].points.length - 1].n,
            )}.`
          : ""
      }`}
      units={`Rate in percent by ${variable.toLowerCase()}; bands are Wilson 95% CIs.`}
      source={`n = ${count(n)} scored responses · ${exps.map((e) => e.id).join(", ")}`}
      fileName={`${inv.id}-curve`}
      table={{
        columns: ["Series", variable, "k", "n", "Rate", "Wilson 95% CI"],
        rows: series.flatMap((s) =>
          s.points.map((p) => {
            const ci = wilson(p.k, p.n);
            return [s.label, p.x, p.k, p.n, formatPct(p.k / p.n), `${formatPct(ci[0])} to ${formatPct(ci[1])}`];
          }),
        ),
      }}
    >
      {({ titleId, descId }) => (
        <div ref={ref} className="w-full">
          {width > 0 && (
            <svg width={W} height={H} role="img" aria-labelledby={`${titleId} ${descId}`} className="block font-sans">
              {ticks(yMin, yMax, yStep).map((t) => (
                <g key={t}>
                  <line x1={left} x2={W - right} y1={y(t)} y2={y(t)} stroke="var(--line)" />
                  <text x={left - 6} y={y(t) + 4} textAnchor="end" fontSize={12} fill="var(--ink-3)">
                    {t}%
                  </text>
                </g>
              ))}
              {levels.map((l) => (
                <text key={l} x={xOf(l)} y={H - bottom + 18} textAnchor="middle" fontSize={12} fill="var(--ink-3)">
                  {l}
                </text>
              ))}
              {series.map((s) => {
                const pts = s.points.map((p) => ({ X: xOf(p.x), r: p.k / p.n, ci: wilson(p.k, p.n) }));
                const band =
                  pts.map((p, i) => `${i ? "L" : "M"}${p.X},${y(p.ci[1] * 100)}`).join("") +
                  pts
                    .slice()
                    .reverse()
                    .map((p) => `L${p.X},${y(p.ci[0] * 100)}`)
                    .join("") +
                  "Z";
                return (
                  <g key={s.label}>
                    <path d={band} fill={s.color} opacity={0.14} />
                    <path d={pts.map((p, i) => `${i ? "L" : "M"}${p.X},${y(p.r * 100)}`).join("")} fill="none" stroke={s.color} strokeWidth={2} />
                    {pts.map((p) => (
                      <circle key={p.X} cx={p.X} cy={y(p.r * 100)} r={3.5} fill={s.color} />
                    ))}
                  </g>
                );
              })}
              {series.length > 1 &&
                series.map((s, i) => (
                  <g key={s.label} transform={`translate(${left + i * Math.min(200, (W - left) / 2)}, 10)`}>
                    <line x1={0} x2={16} y1={0} y2={0} stroke={s.color} strokeWidth={2} />
                    <text x={22} y={4} fontSize={12} fill="var(--ink-2)">
                      {s.label}
                    </text>
                  </g>
                ))}
              <text x={(left + W - right) / 2} y={H - 6} textAnchor="middle" fontSize={12} fill="var(--ink-2)">
                {variable} ({unit}s)
              </text>
            </svg>
          )}
        </div>
      )}
    </ChartFrame>
  );
}

/* ── Heatmap: row × column grid, each cell with its value and n ── */

export function Heatmap({ exp }: { exp: Experiment }) {
  const run = primaryRun(exp);
  const g = exp.design.grid;
  const [ref, width] = useWidth<HTMLDivElement>();
  if (!run?.grid || !g) return null;
  const cells = run.grid;
  const rates = cells.map((c) => c.k / c.n);
  const lo = Math.min(...rates);
  const hi = Math.max(...rates);
  const W = Math.max(300, width);
  const left = 56;
  const top = 28;
  const cw = (W - left) / g.colLevels.length;
  const ch = 36;
  const H = top + g.rowLevels.length * ch + 56;
  const t = (v: number) => (hi === lo ? 0.5 : (v - lo) / (hi - lo));
  const fill = (v: number) => `color-mix(in srgb, var(--accent) ${Math.round(12 + t(v) * 88)}%, var(--surface-sunken))`;
  const dark = (v: number) => 12 + t(v) * 88 > 52;
  const worst = cells.reduce((a, c) => (c.k / c.n < a.k / a.n ? c : a));
  const best = cells.reduce((a, c) => (c.k / c.n > a.k / a.n ? c : a));
  const n = cells.reduce((s, c) => s + c.n, 0);
  return (
    <ChartFrame
      title={`${exp.design.metric.name} by ${g.rowVariable.toLowerCase()} and ${g.colVariable.toLowerCase()}`}
      takeaway={`Lowest at ${g.rowVariable.toLowerCase()} ${worst.row}, ${worst.col} (${formatPct(worst.k / worst.n, 0)}); highest at ${best.row}, ${best.col} (${formatPct(best.k / best.n, 0)}).`}
      units={`Each cell: rate in percent and n. Darker means a higher rate (${formatPct(lo, 0)} to ${formatPct(hi, 0)}).`}
      source={`n = ${count(n)} items, ${g.nPerCell} per cell · ${exp.id}`}
      fileName={`${exp.id}-heatmap`}
      table={{
        columns: [g.rowVariable, g.colVariable, "k", "n", "Rate"],
        rows: cells.map((c) => [c.row, c.col, c.k, c.n, formatPct(c.k / c.n)]),
      }}
    >
      {({ titleId, descId }) => (
        <div ref={ref} className="w-full">
          {width > 0 && (
            <svg width={W} height={H} role="img" aria-labelledby={`${titleId} ${descId}`} className="block font-sans">
              {g.colLevels.map((c, j) => (
                <text key={c} x={left + j * cw + cw / 2} y={top - 10} textAnchor="middle" fontSize={12} fill="var(--ink-3)">
                  {c}
                </text>
              ))}
              {g.rowLevels.map((r, i) => (
                <text key={r} x={left - 8} y={top + i * ch + ch / 2 + 4} textAnchor="end" fontSize={12} fill="var(--ink-3)">
                  {r}
                </text>
              ))}
              {cells.map((c) => {
                const i = g.rowLevels.indexOf(c.row);
                const j = g.colLevels.indexOf(c.col);
                const v = c.k / c.n;
                return (
                  <g key={`${c.row}-${c.col}`}>
                    <rect x={left + j * cw + 1} y={top + i * ch + 1} width={cw - 2} height={ch - 2} rx={4} style={{ fill: fill(v) }} />
                    <text
                      x={left + j * cw + cw / 2}
                      y={top + i * ch + ch / 2 + 4}
                      textAnchor="middle"
                      fontSize={12}
                      style={{ fill: dark(v) ? "var(--accent-ink)" : "var(--ink)" }}
                      className="tabular"
                    >
                      {num(v * 100, 0)}%{cw > 70 ? ` · ${c.n}` : ""}
                    </text>
                  </g>
                );
              })}
              <text x={left + (W - left) / 2} y={top + g.rowLevels.length * ch + 18} textAnchor="middle" fontSize={12} fill="var(--ink-2)">
                {g.colVariable}
              </text>
              <g transform={`translate(${left}, ${top + g.rowLevels.length * ch + 30})`}>
                {Array.from({ length: 10 }, (_, k) => (
                  <rect key={k} x={k * 14} y={0} width={14} height={10} style={{ fill: fill(lo + ((hi - lo) * k) / 9) }} />
                ))}
                <text x={146} y={9} fontSize={12} fill="var(--ink-3)">
                  {formatPct(lo, 0)} to {formatPct(hi, 0)}
                </text>
              </g>
              <text x={8} y={top + (g.rowLevels.length * ch) / 2} fontSize={12} fill="var(--ink-2)" transform={`rotate(-90 8 ${top + (g.rowLevels.length * ch) / 2})`} textAnchor="middle">
                {g.rowVariable}
              </text>
            </svg>
          )}
        </div>
      )}
    </ChartFrame>
  );
}

/** The result of one replication, for the experiment panel. */
export function replicationResults(exp: Experiment) {
  return exp.runs
    .filter((r) => r.role === "replication")
    .map((run) => ({ run, r: analyzeRun(run, exp.design.pairing) }));
}
