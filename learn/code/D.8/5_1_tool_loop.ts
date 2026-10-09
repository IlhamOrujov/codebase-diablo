export {};
// Agent loop с tool calling (формат сообщений OpenAI/Z.ai). Модель — скрипт, tools — настоящий код.
type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
type Msg =
  | { role: "user" | "system"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

const TOOLS: Record<string, (args: Record<string, unknown>) => unknown> = {
  run_experiment: (a) => ({ control: { k: 41, n: 80 }, treatment: { k: 51, n: 80 }, arms: a }),  // «system measures»
};

// Сценарий «модели»: сначала просит tool, потом отвечает текстом
const script: Msg[] = [
  { role: "assistant", content: null, tool_calls: [{ id: "call_1", type: "function", function: { name: "run_experiment", arguments: '{"control":"v1","treatment":"v2"}' } }] },
  { role: "assistant", content: "v2 is worse on this set; see the measured counts." },
];
let turn = 0;
const model = async (_m: Msg[]) => script[turn++];

async function agent(question: string, maxSteps = 5) {
  const messages: Msg[] = [{ role: "user", content: question }];
  for (let step = 1; step <= maxSteps; step++) {          // stop condition №1: budget шагов
    const reply = (await model(messages)) as Extract<Msg, { role: "assistant" }>;
    messages.push(reply);
    if (!reply.tool_calls?.length) return { answer: reply.content, steps: step, messages: messages.length };  // №2: нет tool calls
    for (const tc of reply.tool_calls) {
      const fn = TOOLS[tc.function.name];
      const result = fn ? fn(JSON.parse(tc.function.arguments)) : { error: `unknown tool ${tc.function.name}` };
      messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
    }
  }
  throw new Error("step budget exhausted");
}
agent("Why is v2 worse?").then(console.log);
