export {}; // файл — module: свои имена не конфликтуют с другими файлами
// Discriminated union: поле type говорит, какой это вариант
type ToolCall =
  | { type: "function"; id: string; name: string; args: string }
  | { type: "custom"; id: string; input: string };

function describe(tc: ToolCall): string {
  if (tc.type === "function") return `function ${tc.name}(${tc.args})`; // здесь TS знает про name и args
  return `custom input=${tc.input}`;                                    // а здесь — только про input
}

const calls: ToolCall[] = [
  { type: "function", id: "c1", name: "run_experiment", args: '{"n":60}' },
  { type: "custom", id: "c2", input: "raw text" },
];
for (const c of calls) console.log(describe(c));
