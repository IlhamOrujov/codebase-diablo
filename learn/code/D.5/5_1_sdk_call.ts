// Нужен ZAI_API_KEY. openai SDK как клиент GLM: тот же протокол, но с типами.
import OpenAI from "openai";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";

process.loadEnvFile(".env.local");
const client = new OpenAI({
  apiKey: process.env.ZAI_API_KEY,
  baseURL: "https://api.z.ai/api/paas/v4/",
  maxRetries: 0,          // ретраи делаем сами: 429 у Z.ai бывает и «нет баланса»
  timeout: 600_000,
});

async function main() {
  // thinking — поле Z.ai, которого нет в типах SDK: расширяем тип через intersection
  const body: ChatCompletionCreateParamsNonStreaming & { thinking?: { type: "enabled" } } = {
    model: process.env.GLM_MODEL ?? "glm-5.3",
    messages: [{ role: "user", content: "Name one cause of LLM sycophancy in 10 words." }],
    reasoning_effort: "low",
    max_tokens: 2048,
    thinking: { type: "enabled" },
  };
  const t = performance.now();
  const r = await client.chat.completions.create(body);
  const msg = r.choices[0].message as typeof r.choices[0]["message"] & { reasoning_content?: string };
  console.log({ content: msg.content, reasoning: msg.reasoning_content?.slice(0, 60), usage: r.usage, ms: Math.round(performance.now() - t) });
}
main().catch((e) => {
  if (e instanceof OpenAI.APIError) console.log("APIError", e.status, e.code, e.message);   // code = business code Z.ai
  else throw e;
});
