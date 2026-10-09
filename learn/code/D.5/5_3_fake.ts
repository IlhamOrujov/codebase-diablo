export {}; // файл — module: свои имена не конфликтуют с другими файлами
// Port + adapter + FakeLLM: код зависит от interface, а не от Z.ai
interface ChatRequest { messages: { role: "system" | "user" | "assistant"; content: string }[]; json?: boolean }
interface ChatResponse { content: string; finishReason: "stop" | "length" }
interface LLM { readonly model: string; chat(req: ChatRequest): Promise<ChatResponse> }

class FakeLLM implements LLM {
  readonly model = "fake";
  readonly calls: ChatRequest[] = [];
  constructor(private replies: string[]) {}
  async chat(req: ChatRequest): Promise<ChatResponse> {
    this.calls.push(req);                              // тест потом проверяет, что ушло в модель
    const r = this.replies.shift();
    if (r === undefined) throw new Error(`FakeLLM: no reply #${this.calls.length}`);
    return { content: r, finishReason: "stop" };
  }
}

async function countHypotheses(llm: LLM, question: string): Promise<number> {   // «бизнес-код» не знает, кто модель
  const r = await llm.chat({ messages: [{ role: "user", content: question }], json: true });
  return (JSON.parse(r.content) as { hypotheses: unknown[] }).hypotheses.length;
}
const fake = new FakeLLM(['{"hypotheses":["shorter prompt","higher temperature"]}']);
countHypotheses(fake, "Why is v2 worse?").then((n) => console.log("hypotheses:", n, "| calls:", fake.calls.length, "| json:", fake.calls[0].json));
