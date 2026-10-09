export {};
// Grounding: LLM ссылается на числа только через {{F#}}; код проверяет и подставляет
type Fact = { id: string; label: string; formatted: string };
const facts: Fact[] = [
  { id: "F1", label: "E1 Δ accuracy", formatted: "−15.0 pp" },
  { id: "F2", label: "E1 p (McNemar)", formatted: "0.012" },
];
const VERDICT_WORDS = ["supported", "rejected", "proven", "significant"];

function checkGrounding(text: string): string[] {
  const issues: string[] = [];
  for (const m of text.matchAll(/\{\{(F\d+)\}\}/g)) if (!facts.some((f) => f.id === m[1])) issues.push(`unknown fact ${m[1]}`);
  const bare = text.replace(/\{\{F\d+\}\}/g, "").replace(/\b[HEF]\d+\b/g, "");   // убрали ссылки и ids
  if (/\d|%|\bpp\b/.test(bare)) issues.push("free number in text");
  for (const w of VERDICT_WORDS) if (new RegExp(`\\b${w}\\b`, "i").test(bare)) issues.push(`verdict word "${w}"`);
  return issues;
}
const render = (t: string) => t.replace(/\{\{(F\d+)\}\}/g, (_, id) => facts.find((f) => f.id === id)!.formatted);

const good = "In E1 accuracy dropped by {{F1}} (p = {{F2}}), consistent with H1.";
const bad = "Accuracy dropped by 18% and H1 is clearly supported; see {{F9}}.";
console.log(checkGrounding(good), "→", render(good));
console.log(checkGrounding(bad));
