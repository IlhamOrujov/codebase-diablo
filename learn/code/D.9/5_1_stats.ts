// «The system measures»: готовые функции проекта из src/lib/stats.ts
import { wilson, newcombe, twoProportionZ, mcnemarExact, cohensH, holm, formatP, formatPP, formatCIpp, formatPct } from "@/lib/stats";

const [kC, nC, kT, nT] = [69, 80, 57, 80];          // control 69/80 верно, treatment 57/80
console.log("control  ", formatPct(kC / nC), "CI", wilson(kC, nC).map((x) => formatPct(x)));
console.log("treatment", formatPct(kT / nT), "CI", wilson(kT, nT).map((x) => formatPct(x)));
// Соглашение проекта: arm 1 = control, arm 2 = treatment, результат = treatment − control
console.log("Δ", formatPP(kT / nT - kC / nC), "95% CI", formatCIpp(newcombe(kC, nC, kT, nT)));
console.log("unpaired z-test", formatP(twoProportionZ(kC, nC, kT, nT).p));
// Paired: те же 80 items в обоих arms. b = верно только в control, c = верно только в treatment
const [b, c] = [16, 4];
console.log("paired McNemar ", formatP(mcnemarExact(b, c)), "| Cohen's h", cohensH(kC / nC, kT / nT).toFixed(2));
console.log("Holm for 3 primary p:", holm([0.012, 0.03, 0.2]).map((p) => formatP(p)));
