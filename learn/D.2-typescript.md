# УРОК D.2 — TypeScript for Diablo

Блок D · Building Diablo · Прогресс: D.2 / D.10

*Четыре конструкции TypeScript, на которых держится agent: union, generic, async и собственные ошибки.*

Источник — [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html).

## 1. ГДЕ МЫ

Часы курса: 0:40–1:40.

Окружение готово: ветка `agent/glm`, ключ в `.env.local`, `openai` и `tsx` установлены (D.1). Теперь язык. **TypeScript** — JavaScript плюс **types**: описания формы данных, которые проверяются до запуска командой `npm run typecheck` (`tsc --noEmit`). Все программы урока лежат в `learn/code/D.2/`, запуск: `npx tsx learn/code/D.2/<файл>.ts`.

## 2. ИДЕЯ

Ответ LLM — это данные неизвестной формы, приходящие по сети с ошибками. TypeScript превращает «неизвестно что» в точно описанные варианты: этот ответ — успех или один из семи видов ошибки, это сообщение — текст или вызов tool. Когда все варианты описаны в types, compiler не даст забыть обработать ни один. Для agent это критично: забытая ветка — это бесконечный цикл или выдуманное число в отчёте.

## 3. МЕХАНИЗМ

| Часть | На какой вопрос отвечает |
|---|---|
| A. Types и unions | Как описать «одно из нескольких»? |
| B. Generics | Как написать одну функцию для любого типа данных? |
| C. Async и Promise | Как ждать сеть и не ждать лишнего? |
| D. Ошибки как данные | Как решить, повторять ли запрос? |

### A. Types и unions

*«Как описать “одно из нескольких”?»*

**Суть.** `type` или `interface` описывает форму объекта. **Union** `A | B` — значение одного из типов. **Discriminated union** — union, где общее поле (обычно `type` или `kind`) говорит, какой вариант перед тобой. Проверка этого поля — **narrowing**: внутри `if (x.type === "function")` compiler знает точный вариант.

**Тонкость.** В `openai` SDK v7 tool call — это union `function | custom`. Без narrowing обращение к `tc.function.name` не скомпилируется. Это не придирка compiler'а, а защита от варианта, о котором ты не подумал.

**Требует.** Всегда проверять discriminator перед доступом к полям варианта.

Полезное: `readonly` — поле нельзя переписать; `as const` — литерал становится точным типом; `Record<K, V>` — объект «ключ → значение»; `satisfies` — проверить, что значение подходит под тип, не теряя точного типа.

### B. Generics

*«Как написать одну функцию для любого типа данных?»*

**Суть.** **Generic** — параметр типа `<T>`. `Result<T>` — «успех со значением типа T или ошибка». В `callStructured<T>` (D.6) T — тип объекта, который ты ждёшь от модели: hypotheses, интерпретация, вердикт judge.

**Тонкость.** Обычно T не пишут руками: compiler выводит его из аргумента. Если пришлось писать `as T`, ты, скорее всего, обходишь проверку, а не делаешь её.

**Требует.** Различать «тип известен compiler'у» и «данные проверены в runtime». Generic даёт первое, zod (D.6) — второе.

### C. Async и Promise

*«Как ждать сеть и не ждать лишнего?»*

**Суть.** **Promise** — результат, который будет позже. `async` функция всегда возвращает Promise, `await` ждёт его. Три `await` подряд — последовательное ожидание, `Promise.all([...])` — параллельное.

**Тонкость.** `await` внутри цикла `for` — последовательно. Для 160 вызовов target по 2 секунды это 5 минут против десятков секунд в параллели. Но неограниченная параллельность упирается в **rate limit** — лимит одновременных запросов у Z.ai. Правильный ответ — ограниченный pool (D.3).

**Требует.** Решать, какие вызовы независимы, и запускать их вместе, но не все сразу.

### D. Ошибки как данные

*«Как решить, повторять ли запрос?»*

**Суть.** `class X extends Error` — свой тип ошибки с полями. В Diablo у `LLMError` есть поле `kind`: `rate_limit`, `balance`, `timeout` и так далее. Решение «повторять или нет» принимает код по `kind`, а не по тексту сообщения.

**Тонкость.** В `catch (e)` значение `e` имеет тип `unknown`: бросить можно что угодно. Сужай через `instanceof LLMError`, прежде чем читать поля.

**Требует.** Повторять только временные ошибки. «Нет баланса» не исчезнет от пятого повтора.

## 4. ПРИМЕР

Z.ai вернул HTTP 429. Это может быть временный rate limit (business code 1302) или закончившийся баланс (1113). Если хранить ошибку как строку, обе выглядят одинаково, и agent будет бесконечно повторять безнадёжный запрос, тратя budget времени. Если хранить её как `LLMError` с `kind`, правило `RETRYABLE.has(err.kind)` повторит первую и сразу остановится на второй. Одна строка типа экономит часы отладки.

## 5. КОД

Четыре программы, каждая к своей части урока. Все запускаются как есть.

### 5.1. Discriminated union и narrowing (часть A)

```ts
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
```

Что увидишь:

```text
function run_experiment({"n":60})
custom input=raw text
```

### 5.2. Generic Result (часть B)

```ts
export {};
// Generic Result<T>: успех или ошибка, без исключений
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function parseNumber(s: string): Result<number> {
  const n = Number(s);
  return Number.isFinite(n) ? { ok: true, value: n } : { ok: false, error: `not a number: ${s}` };
}

function firstOk<T>(results: Result<T>[]): T | null {   // T выводится из аргумента
  for (const r of results) if (r.ok) return r.value;
  return null;
}

const rs = ["abc", "42", "7"].map(parseNumber);
console.log(rs);
console.log("first ok:", firstOk(rs));
```

Что увидишь:

```text
[
  { ok: false, error: 'not a number: abc' },
  { ok: true, value: 42 },
  { ok: true, value: 7 }
]
first ok: 42
```

### 5.3. Последовательно vs параллельно (часть C)

```ts
export {};
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
async function fakeCall(name: string): Promise<string> {
  await sleep(200);               // как будто запрос к модели на 200 ms
  return `${name}: ok`;
}

async function main() {
  let t = performance.now();
  await fakeCall("a"); await fakeCall("b"); await fakeCall("c");
  console.log("sequential ms ≈", Math.round((performance.now() - t) / 100) * 100);

  t = performance.now();
  const out = await Promise.all([fakeCall("a"), fakeCall("b"), fakeCall("c")]);
  console.log("parallel   ms ≈", Math.round((performance.now() - t) / 100) * 100, out);
}
main();
```

Что увидишь:

```text
sequential ms ≈ 600
parallel   ms ≈ 200 [ 'a: ok', 'b: ok', 'c: ok' ]
```

### 5.4. Ошибка с kind (часть D)

```ts
export {};
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
```

Что увидишь:

```text
429 / 1302   retry? true
429 / 1113   retry? false
boom         retry? false
```

## 6. ТЕРМИНЫ

| English Name | Объяснение |
|---|---|
| Type / Interface | описание формы данных, проверяемое до запуска |
| Union / Discriminated union | «одно из»; union с полем-меткой варианта |
| Narrowing | сужение типа проверкой (`===`, `instanceof`, `in`) |
| Generic | параметр типа `<T>`: одна функция для разных типов |
| Promise / async / await | результат «позже»; функция, возвращающая Promise; ожидание |
| `Promise.all` | ждать несколько Promise параллельно |
| `unknown` | «что угодно»: перед использованием обязательно сузить |
| `readonly` / `as const` / `satisfies` | запрет изменения / точный литеральный тип / проверка без потери типа |
| Rate limit | лимит одновременных запросов к API |
| Typecheck | проверка типов командой `tsc --noEmit` |

## 7. ПРОВЕРКА

1. Почему discriminated union лучше, чем один тип со всеми полями optional?
2. В 5.2 что изменится, если `firstOk` вернёт `T` вместо `T | null`? Какую ошибку это спрячет?
3. Generic `callStructured<T>` гарантирует, что модель вернула T? Почему нет?
4. Почему `catch (e)` даёт `unknown`, а не `Error`?
5. 160 вызовов по 2 s: сколько займёт последовательный цикл, а сколько — pool на 4? Почему не pool на 160?
6. Чем `kind` в ошибке лучше, чем проверка `message.includes("429")`?
7. Где в Diablo ты бы использовал `Record<string, Price>`, а где — union?

## 8. ЗАДАНИЕ

30 минут. Напиши сам файл `src/lib/agent/llm.ts` — словарь типов всего agent. Требования:

1. `type Effort = "low" | "high" | "max"`.
2. `interface ChatMessage { role: "system" | "user" | "assistant"; content: string }`.
3. `interface ChatRequest` с полями `messages`, а также optional `model`, `effort`, `json` (просить JSON-ответ), `maxTokens`, `temperature`.
4. `type FinishReason = "stop" | "length" | "tool_calls" | "sensitive" | "model_context_window_exceeded" | "network_error" | "unknown"`.
5. `interface Usage { promptTokens: number; completionTokens: number; cachedTokens: number }`.
6. `interface ChatResponse`: `content: string`, `reasoning: string | null`, `finishReason`, `usage`, `model`, `latencyMs`, `costUsd: number | null`.
7. `interface LLM { readonly model: string; chat(req: ChatRequest): Promise<ChatResponse> }` — главный **port**: весь agent зависит только от него.
8. `type LLMErrorKind` из десяти значений: `auth`, `balance`, `quota`, `rate_limit`, `overloaded`, `bad_request`, `sensitive`, `server`, `timeout`, `network`.
9. `class LLMError extends Error` с `readonly kind`, `readonly status: number | null`, `readonly code: string | null`.
10. `const RETRYABLE: ReadonlySet<LLMErrorKind>`: rate_limit, overloaded, server, timeout, network.

Подсказка: сначала types, потом класс, `export` у всего. Без единого `any`.

Готово, когда `npm run typecheck` зелёный и ты можешь объяснить, почему `balance` не входит в RETRYABLE.

## 9. ДАЛЬШЕ

D.3 Node.js for Agents — env, timeouts, хэши, подписи и ограниченная параллельность: инструменты measuring half.
