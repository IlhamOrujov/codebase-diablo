export {}; // файл — module: свои имена не конфликтуют с другими файлами
// Свой класс ошибки с полем kind: решение «повторять или нет» принимает код, а не текст
type LLMErrorKind = "rate_limit" | "balance" | "timeout" | "bad_request";

class LLMError extends Error {
  constructor(message: string, readonly kind: LLMErrorKind) {
    super(message);
    this.name = "LLMError";
  }
}
const RETRYABLE: ReadonlySet<LLMErrorKind> = new Set(["rate_limit", "timeout"]);

function shouldRetry(err: unknown): boolean {
  return err instanceof LLMError && RETRYABLE.has(err.kind);  // unknown → сужаем через instanceof
}

for (const e of [new LLMError("429 / 1302", "rate_limit"), new LLMError("429 / 1113", "balance"), new Error("boom")]) {
  console.log(e.message.padEnd(12), "retry?", shouldRetry(e));
}
