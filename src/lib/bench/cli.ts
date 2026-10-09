/**
 * npm run bench                                   regenerate docs/BENCHMARK.md
 * npm run bench -- --check                        exit 1 if docs/BENCHMARK.md is stale
 * npm run bench -- --scenario K=4,d=10,n=80,r=17  print one scenario (add rho=0.8 to fix ρ)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BENCH_CONFIG, runBenchmark } from "./benchmark";
import { analyze } from "./examples";
import { headline, namedRight, renderAnalysis, renderReport } from "./report";
import type { Cell } from "./scenario";

const root = process.cwd();
if (!existsSync(join(root, "package.json"))) {
  console.error("Run this from the repository root (npm run bench).");
  process.exit(2);
}
const target = join(root, "docs", "BENCHMARK.md");
const args = process.argv.slice(2);

function parseScenario(spec: string): { cell: Cell; rep: number } {
  const kv = Object.fromEntries(spec.split(",").map((p) => p.split("=").map((s) => s.trim())));
  const num = (k: string) => {
    const v = Number(kv[k]);
    if (kv[k] === undefined || !Number.isFinite(v)) throw new Error(`--scenario needs ${k}=<number>, e.g. K=4,d=10,n=80,r=17`);
    return v;
  };
  const cell: Cell = { K: num("K"), effectPP: num("d"), n: num("n") };
  if (kv.rho !== undefined) cell.rho = num("rho");
  return { cell, rep: num("r") };
}

const at = args.indexOf("--scenario");
if (at >= 0) {
  try {
    const { cell, rep } = parseScenario(args[at + 1] ?? "");
    console.log(renderAnalysis(analyze(cell, rep)));
    process.exit(0);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(2);
  }
}

const started = performance.now();
const result = runBenchmark(BENCH_CONFIG);
const report = renderReport(result);
const seconds = ((performance.now() - started) / 1000).toFixed(1);

if (args.includes("--check")) {
  const current = existsSync(target) ? readFileSync(target, "utf8") : "";
  if (current !== report) {
    console.error(`docs/BENCHMARK.md is stale. Run \`npm run bench\` and commit the result. (${seconds} s)`);
    process.exit(1);
  }
  console.log(`docs/BENCHMARK.md is up to date (${seconds} s).`);
  process.exit(0);
}

writeFileSync(target, report);
const h = headline(result);
const d = h.method.diablo;
const D = h.method.largest;
const nr = namedRight(d.all);
console.log(`Wrote docs/BENCHMARK.md in ${seconds} s (${h.scenarios.toLocaleString("en-US")} scenarios).`);
console.log(
  `Diablo: right cause ${((100 * d.cause.correct) / d.cause.scenarios).toFixed(1)}%, innocent blamed ${((100 * d.cause.wrong) / d.cause.scenarios).toFixed(1)}%, false alarm ${((100 * d.none.falseAlarm) / d.none.scenarios).toFixed(1)}%, named causes right ${((100 * nr.right) / nr.named).toFixed(1)}%.`,
);
console.log(
  `Largest drop: right cause ${((100 * D.cause.correct) / D.cause.scenarios).toFixed(1)}%, innocent blamed ${((100 * D.cause.wrong) / D.cause.scenarios).toFixed(1)}%, false alarm ${((100 * D.none.falseAlarm) / D.none.scenarios).toFixed(1)}%.`,
);
