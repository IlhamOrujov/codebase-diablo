# УРОК D.5 — The openai SDK as a GLM Client: port, adapter, fake

Блок D · Building Diablo · Прогресс: D.5 / D.10

*Как вызывать GLM через официальный путь Z.ai для Node и спрятать провайдера за своим interface, чтобы тестировать agent без ключа.*

Источники — [openai-node README](https://github.com/openai/openai-node), [docs.z.ai: Chat Completion](https://docs.z.ai/api-reference/llm/chat-completion) (раздел про OpenAI SDK).

## 1. ГДЕ МЫ

Часы курса: 3:25–4:25.

Ты знаешь протокол (D.4) и умеешь звать его голым `fetch` (D.3). У Z.ai нет своего Node SDK: docs предлагают пакет **`openai`** с другим `baseURL`. В репо стоит `openai@7.30.1`. Программы — `learn/code/D.5/`. 5.1 нужен ключ, 5.2 и 5.3 работают без него.

## 2. ИДЕЯ

SDK даёт types, сериализацию и классы ошибок, но привязывает код к конкретному провайдеру. Если весь Diablo импортирует `openai`, то каждый тест ходит в сеть, тратит деньги и даёт случайный результат. Решение — **ports and adapters**. Diablo зависит только от твоего interface `LLM` (port, `llm.ts` из D.2). Z.ai подключается через adapter `zai.ts`, а тесты — через **FakeLLM**, который отвечает заранее заданными строками. Провайдер становится деталью, которую можно заменить одной строкой.

## 3. МЕХАНИЗМ

| Часть | На какой вопрос отвечает |
|---|---|
| A. Клиент SDK | Как направить `openai` на Z.ai? |
| B. Поля вне types SDK | Как передать `thinking` и прочитать `reasoning_content`? |
| C. Ошибки SDK | Как превратить исключение SDK в `LLMError`? |
| D. Port, adapter, fake | Как сделать agent тестируемым? |

### A. Клиент SDK

*«Как направить `openai` на Z.ai?»*

**Суть.** `new OpenAI({ apiKey, baseURL: "https://api.z.ai/api/paas/v4/", maxRetries: 0, timeout })`, затем `client.chat.completions.create({ model, messages, ... })`. Ответ типизирован: `r.choices[0].message.content`, `r.usage`.

**Тонкость.** По умолчанию SDK сам повторяет запрос до 2 раз на 408, 409, 429 и 5xx. У Z.ai 429 бывает и «нет баланса» (1113): автоповтор только тратит время. Поэтому `maxRetries: 0`, а retry решает твой код по business code.

**Требует.** Создавать клиент только на сервере. Ключ не должен попасть в браузерный bundle.

### B. Поля вне types SDK

*«Как передать `thinking` и прочитать `reasoning_content`?»*

**Суть.** `thinking` в запросе и `reasoning_content` в ответе — поля Z.ai, которых нет в types `openai`. В runtime SDK передаёт неизвестные поля как есть и не вырезает их из ответа. Для compiler'а тип расширяют через **intersection** `A & { thinking?: … }`.

**Тонкость.** `reasoning_effort` уже есть в types SDK: `"low" | "high" | "max"` подходят. Расширяй только то, чего действительно нет, и только в adapter — дальше по коду идут твои types.

**Требует.** Все Z.ai-особенности держать в одном файле `zai.ts`.

### C. Ошибки SDK

*«Как превратить исключение SDK в `LLMError`?»*

**Суть.** SDK бросает `OpenAI.APIError` с полями `status` (HTTP) и `code` (у Z.ai — business code строкой, например `"1302"`). Подклассы: `APIConnectionTimeoutError` — таймаут, `APIConnectionError` — сеть.

**Тонкость.** `APIConnectionTimeoutError` — подкласс `APIConnectionError`, а тот — подкласс `APIError`. Проверяй от частного к общему: сначала timeout, потом connection, потом APIError. Иначе таймаут классифицируется как «сеть».

**Требует.** Функцию `classifyZaiError(status, code)`: сначала business code, потом status.

### D. Port, adapter, fake

*«Как сделать agent тестируемым?»*

**Суть.** **Port** — interface, от которого зависит бизнес-логика: `LLM.chat(req) → ChatResponse`. **Adapter** — реализация port через конкретную технологию (`createZaiLLM`). **Test double** — подмена для тестов: **FakeLLM** возвращает строки из списка и запоминает каждый запрос в `calls`.

**Тонкость.** Fake проверяет не модель, а твой код вокруг неё: собрались ли правильные messages, обработан ли невалидный JSON, остановился ли цикл. Качество самой модели проверяет benchmark (D.10), а не unit test.

**Требует.** Ни один файл кроме `zai.ts` не импортирует `openai`.

## 4. ПРИМЕР

Тест «DRAFT делает repair, если модель вернула невалидный JSON»:

- с настоящим GLM: нужен ключ и $0.03; модель почти всегда отвечает валидно, так что ветку repair ты не увидишь;
- с FakeLLM `["{bad", '{"hypotheses":[...]}']`: бесплатно, 5 ms, ветка repair гарантированно выполняется, а в `fake.calls[1]` видно, какую ошибку код отправил модели.

Тест о поведении кода должен быть детерминированным. Модель недетерминирована по природе (D.1), поэтому в unit tests её нет.

## 5. КОД

Три программы. Запуск: `npx tsx learn/code/D.5/<файл>.ts`.

### 5.1. Вызов GLM через SDK (части A, B, C; нужен ключ)

```ts
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
  // thinking — поле Z.ai, которого нет в types SDK: расширяем тип через intersection
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
```

Что увидишь: объект с ответом, началом рассуждения, usage и ms; текст у каждого вызова свой. С неверным ключом: `APIError 401 1000 …`.

### 5.2. Классификация ошибок (часть C)

```ts
export {};
type Kind = "auth" | "balance" | "quota" | "rate_limit" | "overloaded" | "bad_request" | "sensitive" | "server" | "network";
function classifyZaiError(status: number | null, code: string | null): Kind {
  const c = Number(code);
  if (c === 1113) return "balance";
  if (c >= 1308 && c <= 1321) return "quota";
  if (c === 1302) return "rate_limit";
  if (c === 1305) return "overloaded";
  if (c === 1301) return "sensitive";
  if ([1210, 1211, 1213, 1214, 1261].includes(c)) return "bad_request";
  if ([1200, 1230, 1234].includes(c)) return "server";
  if ([1000, 1001, 1003].includes(c)) return "auth";
  if (status === 401) return "auth";
  if (status === 429) return "rate_limit";
  if (status === 400) return "bad_request";
  if (status !== null && status >= 500) return "server";
  return status === null ? "network" : "bad_request";
}
const RETRY = new Set<Kind>(["rate_limit", "overloaded", "server", "network"]);
for (const [s, c] of [[429, "1302"], [429, "1113"], [429, "1310"], [400, "1211"], [503, null], [null, null]] as const) {
  const k = classifyZaiError(s, c);
  console.log(String(s).padEnd(5), String(c).padEnd(5), k.padEnd(12), "retry:", RETRY.has(k));
}
```

Что увидишь:

```text
429   1302  rate_limit   retry: true
429   1113  balance      retry: false
429   1310  quota        retry: false
400   1211  bad_request  retry: false
503   null  server       retry: true
null  null  network      retry: true
```

### 5.3. Port + FakeLLM (часть D)

```ts
export {};
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
```

Что увидишь:

```text
hypotheses: 2 | calls: 1 | json: true
```

## 6. ТЕРМИНЫ

| English Name | Объяснение |
|---|---|
| SDK | библиотека-клиент для API: типы, сериализация, ошибки |
| `baseURL` | адрес API, на который SDK шлёт запросы |
| `maxRetries` | сколько раз SDK сам повторяет запрос |
| Intersection type `A & B` | тип, у которого есть поля и A, и B |
| `APIError` / `APIConnectionError` / `APIConnectionTimeoutError` | ошибка ответа API / сети / таймаута в SDK |
| Port / Adapter | interface, от которого зависит логика / его реализация через конкретную технологию |
| Test double / Fake | подмена зависимости в тестах / подмена с простой рабочей логикой |
| Dependency injection | передача зависимости (`llm`) параметром вместо импорта |

## 7. ПРОВЕРКА

1. Почему `maxRetries: 0`, хотя SDK умеет повторять сам?
2. Что сломается, если проверять `instanceof APIError` раньше `APIConnectionTimeoutError`?
3. Почему intersection для `thinking` живёт только в `zai.ts`?
4. Какие два свойства теста FakeLLM даёт, а настоящий GLM нет?
5. Что проверяет unit test с FakeLLM, а что он проверить не может?
6. В 5.3 `countHypotheses` получает `llm` параметром. Чем это лучше `import { client } from "./zai"`?
7. Ты хочешь попробовать другой провайдер. Какие файлы Diablo изменятся?

## 8. ЗАДАНИЕ

40 минут. Напиши сам два файла, используя types из `llm.ts`:

1. `src/lib/agent/zai.ts`:
   - `ZAI_BASE_URL`;
   - `classifyZaiError(status, code): LLMErrorKind` по таблице D.4;
   - `createZaiLLM({ apiKey, baseURL?, model?, timeoutMs? }): LLM`.
   `chat(req)` собирает body: `effort` → `reasoning_effort`, `json` → `response_format: {type:"json_object"}`, `maxTokens` → `max_tokens`; поле попадает в body, только если задано. Метод меряет latency, читает `reasoning_content`, считает `costUsd` через `pricing.ts`. Любое исключение SDK превращает в `LLMError` с `kind`, `status`, `code`.
2. `src/lib/agent/fake-llm.ts`: `class FakeLLM implements LLM`. Constructor принимает список ответов: строка, `Error` (её надо бросить) или функция `(req, index) => string`. Есть `calls: ChatRequest[]`. Когда ответы кончились, бросается `Error("FakeLLM: no reply #N")`. Usage по умолчанию нулевой, `finishReason` — `"stop"`, `costUsd` — 0.

Перепиши `scripts/glm-hello.ts` из D.4 на `createZaiLLM`.

Готово, когда `npm run typecheck` зелёный, `glm-hello` печатает те же поля через твой adapter, а с испорченным ключом печатает `LLMError kind=auth`.

## 9. ДАЛЬШЕ

D.6 zod and Structured Output — как получить от модели JSON нужной формы и что делать, когда она ошиблась.
