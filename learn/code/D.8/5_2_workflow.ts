export {};
// Workflow = явная state machine: путь фиксирован кодом, LLM работает только внутри узлов
type State = "DRAFT" | "RUN" | "ANALYZE" | "INTERPRET" | "DONE";
const NEXT: Record<Exclude<State, "DONE">, State> = { DRAFT: "RUN", RUN: "ANALYZE", ANALYZE: "INTERPRET", INTERPRET: "DONE" };
const usesLLM: Record<State, boolean> = { DRAFT: true, RUN: false, ANALYZE: false, INTERPRET: true, DONE: false };

const budget = { llmCalls: 0, maxLlmCalls: 4 };
let state: State = "DRAFT";
const log: string[] = [];
while (state !== "DONE") {
  if (usesLLM[state] && ++budget.llmCalls > budget.maxLlmCalls) throw new Error("LLM budget exceeded");
  log.push(`${state}${usesLLM[state] ? " (LLM)" : " (code)"}`);
  state = NEXT[state];
}
console.log(log.join(" → "), "| llm calls:", budget.llmCalls);
