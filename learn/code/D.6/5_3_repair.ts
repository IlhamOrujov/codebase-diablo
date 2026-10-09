import { z } from "zod";
// Validate-and-repair: невалидный ответ → ошибки обратно модели → ещё попытка (не больше maxRepairs)
type Msg = { role: "system" | "user" | "assistant"; content: string };
const replies = ['{"verdict":"maybe"}', '```json\n{"verdict":"supported","reason":"p below alpha"}\n```'];
const llm = { calls: 0, async chat(_m: Msg[]) { return replies[this.calls++]; } };   // FakeLLM на 2 ответа

const Out = z.object({ verdict: z.enum(["supported", "rejected"]), reason: z.string() });
function extractJson(text: string): unknown {
  return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));        // снимаем ```json fences
}
async function callStructured(messages: Msg[], maxRepairs = 2) {
  for (let attempt = 0; attempt <= maxRepairs; attempt++) {
    const raw = await llm.chat(messages);
    let issues: string;
    try {
      const r = Out.safeParse(extractJson(raw));
      if (r.success) return { value: r.data, repairs: attempt };
      issues = z.prettifyError(r.error);
    } catch {
      issues = "Not valid JSON.";
    }
    messages = [...messages, { role: "assistant", content: raw }, { role: "user", content: `Fix these issues and return only JSON:\n${issues}` }];
  }
  throw new Error("structured output failed");
}
callStructured([{ role: "user", content: "Judge H1." }]).then((r) => console.log(r, "calls:", llm.calls));
