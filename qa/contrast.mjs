// WCAG 2 contrast ratios for every token pair the UI uses. Prints a Markdown table.
// Usage: node qa/contrast.mjs
const T = {
  light: { bg: "#f8f7f4", surface: "#ffffff", subtle: "#f3f1ed", sunken: "#efece6", ink: "#211c1d", "ink-2": "#57514f", "ink-3": "#6f6a69", "accent-text": "#6b0a28", accent: "#57001a", "accent-ink": "#fcf8ef", ok: "#3e6a4c", warn: "#8a5a12", bad: "#8f1d2c", "line-field": "#8f8883" },
  dark: { bg: "#171315", surface: "#211a1d", subtle: "#1c1619", sunken: "#140f12", ink: "#f8f3ea", "ink-2": "#beb5b0", "ink-3": "#968c88", "accent-text": "#e7a6b8", accent: "#7a0a2e", "accent-ink": "#fcf8ef", ok: "#8fbf9c", warn: "#d9a75a", bad: "#ec8f9c", "line-field": "#7d7270" },
};
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const text = ["ink", "ink-2", "ink-3", "accent-text", "ok", "warn", "bad"];
const backs = ["bg", "surface", "subtle", "sunken"];
const rows = [];
for (const theme of ["light", "dark"]) {
  const t = T[theme];
  for (const f of text) for (const b of backs) rows.push([theme, f, b, ratio(t[f], t[b]), 4.5]);
  rows.push([theme, "accent-ink", "accent (Send)", ratio(t["accent-ink"], t.accent), 4.5]);
  rows.push([theme, "bg", "ink (primary button)", ratio(t.bg, t.ink), 4.5]);
  for (const b of ["bg", "surface"]) rows.push([theme, "focus ring (accent-text)", b, ratio(t["accent-text"], t[b]), 3]);
  for (const b of ["bg", "surface"]) rows.push([theme, "field border (line-field)", b, ratio(t["line-field"], t[b]), 3]);
}
const old = [
  ["light", "ink-3 (old #9a9390)", "bg", ratio("#9a9390", "#f8f7f4"), 4.5],
  ["light", "ink-2 (old #6e6868)", "bg", ratio("#6e6868", "#f8f7f4"), 4.5],
  ["dark", "ink-3 (old #8a807c)", "surface", ratio("#8a807c", "#211a1d"), 4.5],
];
console.log("| Theme | Foreground | Background | Ratio | Needs | Pass |\n|---|---|---|---|---|---|");
let fails = 0;
for (const [th, f, b, r, need] of rows) {
  if (r < need) fails++;
  console.log(`| ${th} | ${f} | ${b} | ${r.toFixed(2)}:1 | ${need}:1 | ${r >= need ? "yes" : "**no**"} |`);
}
console.log("\nBefore the fix:\n\n| Theme | Foreground | Background | Ratio |\n|---|---|---|---|");
for (const [th, f, b, r] of old) console.log(`| ${th} | ${f} | ${b} | ${r.toFixed(2)}:1 |`);
console.log(`\n${fails} pair(s) below the requirement.`);
process.exitCode = fails ? 1 : 0;
