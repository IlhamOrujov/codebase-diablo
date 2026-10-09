export {}; // файл — module: свои имена не конфликтуют с другими файлами
// Стоимость вызова: (некэшированный input + кэшированный input + output) по ценам за 1M tokens
type Usage = { promptTokens: number; completionTokens: number; cachedTokens: number };
type Price = { input: number; cachedInput: number; output: number };
const PRICES: Record<string, Price> = {
  "glm-5.3": { input: 1.4, cachedInput: 0.26, output: 4.4 },
  "glm-5.3-flash": { input: 0.15, cachedInput: 0.03, output: 0.5 },
  "glm-4.7-flash": { input: 0, cachedInput: 0, output: 0 },
};
function costUsd(model: string, u: Usage): number | null {
  const p = PRICES[model];
  if (!p) return null;                                  // неизвестная цена ≠ 0
  return ((u.promptTokens - u.cachedTokens) * p.input + u.cachedTokens * p.cachedInput + u.completionTokens * p.output) / 1e6;
}
const draft = { promptTokens: 3000, completionTokens: 6000, cachedTokens: 2000 };   // reasoning входит в output
for (const m of ["glm-5.3", "glm-5.3-flash", "glm-4.7-flash", "gpt-x"]) console.log(m.padEnd(14), costUsd(m, draft)?.toFixed(5) ?? null);
console.log("effort max ≈ 75K output:", costUsd("glm-5.3", { promptTokens: 3000, completionTokens: 75000, cachedTokens: 0 })?.toFixed(4));
