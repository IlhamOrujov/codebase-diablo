# УРОК D.6 — zod and Structured Output

Блок D · Building Diablo · Прогресс: D.6 / D.10

*Как превратить «модель вернула какой-то текст» в «функция вернула проверенный typed object или честную ошибку».*

Источники — [zod v4 docs](https://zod.dev), [docs.z.ai: Chat Completion](https://docs.z.ai/api-reference/llm/chat-completion) (`response_format`).

## 1. ГДЕ МЫ

Часы курса: 4:25–5:25.

У тебя есть adapter `createZaiLLM` и `FakeLLM` (D.5). Модель отвечает строкой. Agent'у нужны объекты: hypotheses, experiments, интерпретация. **zod** (в репо `zod@4.6.5`) — библиотека **schemas**: одно описание формы данных даёт и TypeScript type, и проверку в runtime. Программы — `learn/code/D.6/`, все работают без ключа.

## 2. ИДЕЯ

Types TypeScript исчезают при запуске, а JSON от модели приходит в runtime. Значит, нужна проверка в runtime, и она должна совпадать с types. zod-schema — **single source of truth**: из неё берутся type для кода (`z.infer`), JSON Schema для prompt (`z.toJSONSchema`) и проверка ответа (`safeParse`). Когда проверка падает, ошибка уходит обратно модели, и та исправляется. Это **validate-and-repair loop**: дешёвый способ получить надёжный structured output от модели, которая иногда ошибается.

## 3. МЕХАНИЗМ

| Часть | На какой вопрос отвечает |
|---|---|
| A. Schema и type | Как описать форму данных один раз? |
| B. Проверка | Как отличить валидный ответ от невалидного и объяснить почему? |
| C. Structured output у GLM | Как попросить модель вернуть JSON нужной формы? |
| D. Repair loop | Что делать, когда модель ошиблась? |

### A. Schema и type

*«Как описать форму один раз?»*

**Суть.** `z.object({...})`, `z.string().min(10)`, `z.enum([...])`, `z.array(...).min(2)`, `z.boolean()`, `z.number().int()`, `.regex(...)`, `.optional()`. `type T = z.infer<typeof Schema>` — TypeScript type из schema.

**Тонкость.** `z.enum(["arith-v1", "syco-v1"])` — это **closed vocabulary**: модель может выбрать только то, что твой executor умеет запустить. Список можно строить в runtime из реестра datasets (D.8). Тогда невозможный experiment не проходит schema ещё до запуска.

**Требует.** Ограничения в schema, а не в prompt: prompt — просьба, schema — закон.

### B. Проверка

*«Валидно или нет и почему?»*

**Суть.** `Schema.parse(x)` бросает ошибку, `Schema.safeParse(x)` возвращает `{ success: true, data } | { success: false, error }` (discriminated union из D.2). `z.prettifyError(error)` — человекочитаемый список: поле и что не так.

**Тонкость.** `.refine` и `.superRefine` проверяют правила между полями: «ссылка `hypothesisId` указывает на существующую hypothesis», «хотя бы одна hypothesis — competing». Часть правил удобнее держать отдельной функцией `check(value): string[]`, которая возвращает список проблем тем же языком, что и prettifyError.

**Требует.** В agent всегда `safeParse`, а не `parse`: невалидный ответ — ожидаемое событие, а не исключение.

### C. Structured output у GLM

*«Как попросить JSON нужной формы?»*

**Суть.** У GLM `response_format` принимает только `{"type":"text"}` и `{"type":"json_object"}`. JSON mode гарантирует синтаксически валидный JSON, но не его форму. Режима `json_schema` и strict mode нет. Официальный путь Z.ai: описать schema в system prompt, включить `json_object`, проверить ответ на клиенте.

**Тонкость.** `z.toJSONSchema(Schema)` превращает zod-schema в JSON Schema. Её и вставляют в system prompt: прямо из того же источника, без ручной копии. Модели иногда оборачивают ответ в ```` ```json ```` fences: снимай их до `JSON.parse`.

**Требует.** Проверять `finishReason === "stop"` до парсинга: при `"length"` JSON обрезан, и repair не поможет — нужно больше `maxTokens`.

### D. Repair loop

*«Что делать, когда модель ошиблась?»*

**Суть.** Невалидный ответ → в messages добавляются `assistant: <сырой ответ>` и `user: "Fix these issues: <prettifyError>"` → повторный вызов. Не больше `maxRepairs` (обычно 2). Если и это не помогло — `StructuredError` с последним ответом и списком проблем.

**Тонкость.** Модели проще исправить конкретную ошибку («→ at prediction: expected one of …»), чем угадать снова. Повтор того же запроса без ошибки часто даёт ту же ошибку. Каждый repair — это деньги и время, поэтому число repairs надо считать и показывать (метрика в D.10).

**Требует.** Ограничение числа repairs и честную ошибку в конце, без «тихого» fallback на выдуманные данные.

## 4. ПРИМЕР

DRAFT вернул `{"id":"h1","text":"short","prediction":"worse"}`. `safeParse` даёт четыре проблемы: id не подходит под `/^H\d+$/`, text короче 10 символов, prediction вне enum, `competing` отсутствует. Код отправляет модели `prettifyError` (вывод в 5.1). Модель возвращает исправленный объект — 1 repair, ~1 500 tokens на `low` ≈ $0.007. Без repair loop этот ответ уронил бы весь investigation.

## 5. КОД

Три программы. Запуск: `npx tsx learn/code/D.6/<файл>.ts`.

### 5.1. Schema, type, safeParse, prettifyError (части A, B)

```ts
import { z } from "zod";
// Одна schema = runtime-проверка + TypeScript type
const Hypothesis = z.object({
  id: z.string().regex(/^H\d+$/),
  text: z.string().min(10).max(300),
  prediction: z.enum(["increase", "decrease", "no-difference"]),
  competing: z.boolean(),
});
type Hypothesis = z.infer<typeof Hypothesis>;

const good: unknown = { id: "H1", text: "Shorter system prompt hurts arithmetic.", prediction: "decrease", competing: false };
const bad: unknown = { id: "h1", text: "short", prediction: "worse" };
const g = Hypothesis.safeParse(good);
console.log("good:", g.success, g.success && (g.data satisfies Hypothesis).id);
const b = Hypothesis.safeParse(bad);
if (!b.success) console.log(z.prettifyError(b.error));
```

Что увидишь:

```text
good: true H1
✖ Invalid string: must match pattern /^H\d+$/
  → at id
✖ Too small: expected string to have >=10 characters
  → at text
✖ Invalid option: expected one of "increase"|"decrease"|"no-difference"
  → at prediction
✖ Invalid input: expected boolean, received undefined
  → at competing
```

### 5.2. JSON Schema для prompt (часть C)

```ts
import { z } from "zod";
// z.toJSONSchema: та же schema уходит в prompt (у GLM нет json_schema mode)
const Draft = z.object({
  hypotheses: z.array(z.object({ id: z.string(), competing: z.boolean() })).min(2),
  datasetId: z.enum(["arith-v1", "syco-v1"]),        // closed vocabulary
});
console.log(JSON.stringify(z.toJSONSchema(Draft)));
```

Что увидишь:

```text
{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"hypotheses":{"minItems":2,"type":"array","items":{"type":"object","properties":{"id":{"type":"string"},"competing":{"type":"boolean"}},"required":["id","competing"],"additionalProperties":false}},"datasetId":{"type":"string","enum":["arith-v1","syco-v1"]}},"required":["hypotheses","datasetId"],"additionalProperties":false}
```

### 5.3. Validate-and-repair (часть D)

```ts
import { z } from "zod";
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
```

Что увидишь:

```text
{
  value: { verdict: 'supported', reason: 'p below alpha' },
  repairs: 1
} calls: 2
```

## 6. ТЕРМИНЫ

| English Name | Объяснение |
|---|---|
| Schema | описание допустимой формы данных |
| Single source of truth | одно описание, из которого выводится всё остальное |
| `z.infer` | TypeScript type из zod-schema |
| `parse` / `safeParse` | проверка с исключением / проверка с результатом-union |
| `refine` / `superRefine` | проверка правил между полями |
| `prettifyError` | человекочитаемый список ошибок проверки |
| JSON Schema / `z.toJSONSchema` | стандартный формат описания JSON / перевод zod в него |
| Structured output | ответ модели как объект заданной формы, а не свободный текст |
| JSON mode (`json_object`) | модель обязана вернуть синтаксически валидный JSON |
| Closed vocabulary | значения поля только из фиксированного списка (enum) |
| Validate-and-repair loop | проверка ответа и возврат ошибок модели для исправления |

## 7. ПРОВЕРКА

1. Почему не хватает TypeScript type `Draft` и нужна ещё zod-schema?
2. JSON mode включён. Почему ответ всё равно может не пройти schema?
3. Чем опасно держать список datasets в prompt, а не в `z.enum`?
4. Почему при `finishReason = "length"` repair бесполезен, и что делать вместо него?
5. Почему repair-сообщение содержит ошибки, а не просто «попробуй ещё раз»?
6. Где граница между правилом в schema (`refine`) и функцией `check`?
7. Почему после двух неудачных repairs нужна ошибка, а не «пустой» draft?

## 8. ЗАДАНИЕ

40 минут. Напиши сам `src/lib/agent/structured.ts`:

1. `extractJson(text): unknown` — снимает ```` ``` ```` fences, делает `JSON.parse`, иначе бросает.
2. `schemaBlock(schema): string` — `"Return ONLY one JSON object that matches this JSON Schema:\n" + JSON.stringify(z.toJSONSchema(schema))`.
3. `class StructuredError extends Error` с полями `issues: string`, `lastRaw: string`, `calls: ChatResponse[]`.
4. `callStructured(llm, schema, { system, user }, opts?)` возвращает `{ value, calls, repairs }`:
   - messages = system (`system + schemaBlock`) + user, всегда `json: true`;
   - `finishReason ≠ "stop"` → `StructuredError` сразу, без repair;
   - ошибка JSON, `safeParse` или `opts.check(value)` → assistant(raw) + user(issues) → повтор;
   - всего не больше `1 + maxRepairs` вызовов, default `maxRepairs = 2`;
   - `effort` и `maxTokens` из `opts` передаются в каждый вызов.

Попробуй на FakeLLM из D.5: валидный ответ сразу; невалидный, потом валидный; три невалидных подряд.

Готово, когда все три сценария дают ожидаемый результат (value с repairs 0, value с repairs 1, `StructuredError` с `calls.length === 3`), а `npm run typecheck` зелёный. В D.7 ты закрепишь их тестами.

## 9. ДАЛЬШЕ

D.7 vitest — тесты, которые проверяют agent без ключа, без денег и без случайности.
