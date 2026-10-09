export {}; // файл — module: свои имена не конфликтуют с другими файлами
// Конфиг из env: обязательные значения падают сразу, опциональные получают default
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}
const model = process.env.GLM_MODEL ?? "glm-5.3";       // ?? — default только для undefined/null
const base = process.env.ZAI_BASE_URL ?? "https://api.z.ai/api/paas/v4/";
console.log({ model, base });
try {
  required("ZAI_API_KEY_THAT_DOES_NOT_EXIST");
} catch (e) {
  console.log("error:", (e as Error).message);
}
