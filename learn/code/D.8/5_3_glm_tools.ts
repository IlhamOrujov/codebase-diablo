// Нужен ZAI_API_KEY. Настоящий tool calling на GLM-5.3 (tool_choice у Z.ai — только "auto").
import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";

process.loadEnvFile(".env.local");
const client = new OpenAI({ apiKey: process.env.ZAI_API_KEY, baseURL: "https://api.z.ai/api/paas/v4/", maxRetries: 0 });
const tools: ChatCompletionTool[] = [{
  type: "function",
  function: {
    name: "get_accuracy",
    description: "Measured accuracy of a model version on the arithmetic set",
    parameters: { type: "object", properties: { version: { type: "string", enum: ["v1", "v2"] } }, required: ["version"] },
  },
}];
const MEASURED: Record<string, number> = { v1: 0.86, v2: 0.71 };

async function main() {
  const messages: ChatCompletionMessageParam[] = [{ role: "user", content: "Is v2 less accurate than v1? Use the tool for both." }];
  for (let step = 0; step < 4; step++) {
    const r = await client.chat.completions.create({ model: process.env.GLM_MODEL ?? "glm-5.3", messages, tools, reasoning_effort: "low", max_tokens: 4096 });
    const msg = r.choices[0].message;
    messages.push(msg);
    if (r.choices[0].finish_reason !== "tool_calls" || !msg.tool_calls) return console.log("answer:", msg.content);
    for (const tc of msg.tool_calls) {
      if (tc.type !== "function") continue;                       // union: function | custom
      const { version } = JSON.parse(tc.function.arguments) as { version: string };
      console.log("tool call:", tc.function.name, version);
      messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ accuracy: MEASURED[version] ?? null }) });
    }
  }
}
main();
