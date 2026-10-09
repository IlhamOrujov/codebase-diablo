export {}; // файл — module: свои имена не конфликтуют с другими файлами
// Нужен ZAI_API_KEY. Сырой HTTP-вызов без SDK: так выглядит протокол.
process.loadEnvFile(".env.local");
async function main() {
  const res = await fetch("https://api.z.ai/api/paas/v4/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.ZAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.GLM_MODEL ?? "glm-5.3",
      reasoning_effort: "low",                  // low | high | max; default max — дорого
      max_tokens: 1024,
      messages: [{ role: "user", content: "Reply with OK." }],
    }),
    signal: AbortSignal.timeout(120_000),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`HTTP ${res.status} code=${body?.error?.code} ${body?.error?.message}`);
  console.log(res.status, body.choices[0].finish_reason, JSON.stringify(body.choices[0].message.content), body.usage);
}
main();
