# УРОК D.4 — The GLM API: протокол, reasoning, деньги

Блок D · Building Diablo · Прогресс: D.4 / D.10

*Что уходит в запрос к GLM-5.3, что приходит обратно, сколько это стоит и какие ошибки бывают.*

Источник — [docs.z.ai: Chat Completion](https://docs.z.ai/api-reference/llm/chat-completion), сверено 2026-10-08.

## 1. ГДЕ МЫ

Часы курса: 2:30–3:25.

У тебя есть типы (`llm.ts`, D.2) и сырой HTTP-вызов (`glm-raw.ts`, D.3). Теперь протокол целиком: каждое поле запроса и ответа, которое понадобится Diablo. Программы лежат в `learn/code/D.4/`. 5.1 и 5.2 работают без ключа, 5.3 — с ключом.

## 2. ИДЕЯ

**LLM API** — это одна функция по HTTP: список **messages** на входе, следующее сообщение на выходе. Всё остальное — параметры этой функции. У **reasoning model** перед ответом идёт скрытое рассуждение, и оно оплачивается как output. Поэтому у Diablo каждый вызов — инженерное решение: сколько думать, сколько это стоит, что делать, если ответ оборвался или пришла ошибка.

## 3. МЕХАНИЗМ

| Часть | На какой вопрос отвечает |
|---|---|
| A. Запрос | Что уходит в модель? |
| B. Ответ | Что приходит и как понять, что ответ полный? |
| C. Reasoning | Как управлять «думанием» GLM-5.3? |
| D. Tokens и деньги | Сколько стоит вызов? |
| E. Ошибки | Какие ошибки бывают и какие повторять? |

### A. Запрос

*«Что уходит в модель?»*

**Суть.** `POST https://api.z.ai/api/paas/v4/chat/completions`, заголовок `Authorization: Bearer <ключ>`. Тело: `model` (`"glm-5.3"`) и `messages` — массив `{role, content}`. Roles: **system** (правила), **user** (вопрос), **assistant** (прошлые ответы модели), **tool** (результат вызванного tool, D.8).

**Тонкость.** Модель не помнит ничего между вызовами: весь контекст — это `messages`, который ты отправляешь каждый раз. «Память» agent — твой код, собирающий этот массив.

**Требует.** Явно задавать `max_tokens` (лимит output, по умолчанию 65 536, максимум 131 072) и `reasoning_effort`.

Ещё параметры: `temperature` (0–1, default 1.0 — случайность выбора токенов), `response_format: {"type":"json_object"}` (JSON mode, D.6), `tools` (D.8). JSON schema mode (`json_schema`) у GLM нет.

### B. Ответ

*«Как понять, что ответ полный?»*

**Суть.** `choices[0].message.content` — ответ, `choices[0].message.reasoning_content` — рассуждение (отдельное поле, не внутри content), `choices[0].finish_reason` — почему модель остановилась, `usage` — расход tokens.

**Тонкость.** `finish_reason` — главный флаг доверия. `"stop"` — ответ завершён. `"length"` — упёрся в `max_tokens`, JSON обрезан. `"sensitive"` — заблокировала модерация. `"tool_calls"` — модель просит вызвать tool. Обрезанный JSON без проверки `finish_reason` даёт непонятную ошибку парсинга далеко от причины.

**Требует.** Проверять `finish_reason` до парсинга content.

### C. Reasoning

*«Как управлять думанием?»*

**Суть.** У GLM-5.3 thinking всегда включён: `thinking: {"type":"disabled"}` даёт ошибку. Глубину задаёт `reasoning_effort`: `"low"`, `"high"`, `"max"`. Default — `"max"`.

**Тонкость.** Default `max` — дорогой: порядка 75K output tokens ≈ $0.33 за вызов. Для Diablo: DRAFT (придумать hypotheses и experiments) — `high`, INTERPRET и repair — `low`. Effort — это решение о бюджете, а не «качество побольше».

**Требует.** Задавать effort явно на каждом вызове.

### D. Tokens и деньги

*«Сколько стоит вызов?»*

**Суть.** **Token** — кусок текста, примерно 3–4 символа английского. Цена — за 1M tokens:

| Model | Input | Cached input | Output |
|---|---|---|---|
| `glm-5.3` (reasoner) | $1.40 | $0.26 | $4.40 |
| `glm-5.3-flash` (judge) | $0.15 | $0.03 | $0.50 |
| `glm-4.7-flash`, `glm-4.5-flash` (targets) | $0 | $0 | $0 |

Формула: `((prompt − cached) · input + cached · cachedInput + completion · output) / 1e6`.

**Тонкость.** **Caching** у Z.ai автоматический: одинаковое начало `messages` (system prompt) в следующем вызове считается по цене cached. Поэтому стабильный system prompt идёт первым, а меняющиеся данные — в конце. Reasoning входит в `completion_tokens`.

**Требует.** Считать стоимость каждого вызова и хранить её. Неизвестная цена — это `null`, а не 0.

### E. Ошибки

*«Какие повторять?»*

**Суть.** Тело ошибки: `{"error":{"code":"1302","message":"..."}}`. HTTP status говорит класс, **business code** — точную причину.

| HTTP | Code | Смысл | Повторять? |
|---|---|---|---|
| 401 | 1000 / 1001 / 1003 | ключ неверный, отсутствует или истёк | нет |
| 400 | 1211 | unknown model | нет |
| 400 | 1210 / 1213 / 1214 | неверный или отсутствующий параметр | нет |
| 400 | 1261 | prompt слишком длинный | нет |
| 400 | 1301 | небезопасный контент | нет |
| 429 | 1302 | rate limit | да, с паузой |
| 429 | 1305 | сервис перегружен | да, с паузой |
| 429 | 1113 | нет баланса | нет |
| 429 | 1308–1321 | квота исчерпана | нет |
| 5xx | — | сбой сервера | да |

**Тонкость.** Один и тот же 429 — то временный rate limit, то пустой баланс. Классифицировать по status нельзя, только по business code.

**Требует.** Свою функцию классификации (D.5) и retry только для временных причин.

## 4. ПРИМЕР

Один DRAFT-вызов: 3 000 tokens prompt, из них 2 000 cached (system prompt совпал с прошлым вызовом), 6 000 tokens output (reasoning + JSON).

`(1 000 · 1.40 + 2 000 · 0.26 + 6 000 · 4.40) / 1e6 = (1 400 + 520 + 26 400) / 1e6 = $0.02832`.

Тот же вызов с effort `max` и ~75 000 output tokens без cache: ≈ $0.334 — в 12 раз дороже. Investigation из ~10 вызовов на `high`/`low` укладывается в ~$0.20; на default `max` — около $3.

## 5. КОД

Три программы. Запуск: `npx tsx learn/code/D.4/<файл>.ts`.

### 5.1. Стоимость вызова (часть D)

```ts
export {};
type Usage = { promptTokens: number; completionTokens: number; cachedTokens: number };
type Price = { input: number; cachedInput: number; output: number };
const PRICES: Record<string, Price> = {
  "glm-5.3": { input: 1.4, cachedInput: 0.26, output: 4.4 },
  "glm-5.3-flash": { input: 0.15, cachedInput: 0.03, output: 0.5 },
  "glm-4.7-flash": { input: 0, cachedInput: 0, output: 0 },
};
function costUsd(model: string, u: Usage): number | null {
  const p = PRICES[model];
  if (!p) return null;                                  // неизвестная цена ≠ 0
  return ((u.promptTokens - u.cachedTokens) * p.input + u.cachedTokens * p.cachedInput + u.completionTokens * p.output) / 1e6;
}
const draft = { promptTokens: 3000, completionTokens: 6000, cachedTokens: 2000 };   // reasoning входит в output
for (const m of ["glm-5.3", "glm-5.3-flash", "glm-4.7-flash", "gpt-x"]) console.log(m.padEnd(14), costUsd(m, draft)?.toFixed(5) ?? null);
console.log("effort max ≈ 75K output:", costUsd("glm-5.3", { promptTokens: 3000, completionTokens: 75000, cachedTokens: 0 })?.toFixed(4));
```

Что увидишь:

```text
glm-5.3        0.02832
glm-5.3-flash  0.00321
glm-4.7-flash  0.00000
gpt-x          null
effort max ≈ 75K output: 0.3342
```

### 5.2. Разбор ответа (часть B)

```ts
export {};
// Форма ответа из docs.z.ai. Числа — пример.
const raw = `{"id":"2026100900001","request_id":"req-001","model":"glm-5.3",
 "choices":[{"index":0,"finish_reason":"stop",
   "message":{"role":"assistant","content":"OK","reasoning_content":"The user wants the word OK."}}],
 "usage":{"prompt_tokens":14,"completion_tokens":27,"total_tokens":41,"prompt_tokens_details":{"cached_tokens":0}}}`;

type ZaiResponse = {
  model: string;
  choices: { finish_reason: string; message: { content: string | null; reasoning_content?: string } }[];
  usage: { prompt_tokens: number; completion_tokens: number; prompt_tokens_details?: { cached_tokens?: number } };
};
const r = JSON.parse(raw) as ZaiResponse;
const c = r.choices[0];
console.log({
  content: c.message.content,
  reasoningChars: c.message.reasoning_content?.length ?? 0,
  finish: c.finish_reason,                      // stop | length | tool_calls | sensitive | ...
  prompt: r.usage.prompt_tokens,
  completion: r.usage.completion_tokens,        // включает reasoning
  cached: r.usage.prompt_tokens_details?.cached_tokens ?? 0,
});
```

Что увидишь:

```text
{
  content: 'OK',
  reasoningChars: 27,
  finish: 'stop',
  prompt: 14,
  completion: 27,
  cached: 0
}
```

### 5.3. Настоящий вызов через fetch (части A, C; нужен ключ)

```ts
export {};
process.loadEnvFile(".env.local");
async function main() {
  const res = await fetch("https://api.z.ai/api/paas/v4/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.ZAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.GLM_MODEL ?? "glm-5.3",
      reasoning_effort: "low",                  // low | high | max; default max — дорого
      max_tokens: 1024,
      messages: [{ role: "user", content: "Reply with OK." }],
    }),
    signal: AbortSignal.timeout(120_000),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`HTTP ${res.status} code=${body?.error?.code} ${body?.error?.message}`);
  console.log(res.status, body.choices[0].finish_reason, JSON.stringify(body.choices[0].message.content), body.usage);
}
main();
```

Что увидишь (числа у каждого вызова свои): `200 stop "OK" { prompt_tokens: …, completion_tokens: …, total_tokens: …, prompt_tokens_details: { cached_tokens: 0 } }`. Запусти второй раз и сравни `cached_tokens`.

## 6. ТЕРМИНЫ

| English Name | Объяснение |
|---|---|
| Chat completions | API «messages → следующее сообщение» |
| Message role (system / user / assistant / tool) | кто автор сообщения в контексте модели |
| Context | весь массив messages, который видит модель в одном вызове |
| Token | единица текста, в которой считают длину и цену |
| `max_tokens` | лимит output-tokens ответа |
| Temperature | степень случайности выбора следующего token |
| Reasoning model / `reasoning_content` | модель со скрытым рассуждением / поле с этим рассуждением |
| `reasoning_effort` | глубина рассуждения: low / high / max |
| `finish_reason` | причина остановки: stop, length, tool_calls, sensitive… |
| Usage / Cached tokens | расход tokens / tokens prompt, взятые из cache по сниженной цене |
| Business code | код причины ошибки Z.ai внутри тела ответа |
| JSON mode | режим, в котором модель обязана вернуть валидный JSON-объект |

## 7. ПРОВЕРКА

1. Почему у agent «памяти» нет внутри модели, и где она тогда живёт?
2. Что сделает Diablo, если `finish_reason = "length"` у ответа DRAFT? Почему нельзя просто парсить?
3. Почему system prompt должен быть одинаковым и стоять первым? Посчитай выигрыш для 2 000 cached tokens.
4. Почему у GLM-5.3 нельзя «выключить думание», и что делать, если нужен быстрый дешёвый ответ?
5. HTTP 429: в каких двух случаях повтор бесполезен?
6. Почему неизвестная цена — `null`, а не 0?
7. Сколько стоит investigation из 2 DRAFT (`high`, 6K output) и 2 INTERPRET (`low`, 1.5K output) без cache, по 3K prompt каждый?

## 8. ЗАДАНИЕ

35 минут. Напиши сам:

1. `src/lib/agent/pricing.ts`: `interface Price`, `MODEL_PRICES: Readonly<Record<string, Price>>` для `glm-5.3`, `glm-5.2`, `glm-5.3-flash`, `glm-4.7-flash`, `glm-4.5-flash` (цены из таблицы части D) и `costUsd(model, usage): number | null`. `Usage` импортируй из `llm.ts`.
2. `scripts/glm-hello.ts`: один и тот же вопрос («Предложи две причины, почему новая версия модели хуже решает арифметику») с `reasoning_effort` low, high и max. Для каждого печатай latency в ms, `finish_reason`, длину `reasoning_content`, usage и `costUsd`. Запусти и запиши результаты в `learn/my/D.4.md`.

Готово, когда три строки замеров записаны и ты можешь назвать effort, который выбрал бы для DRAFT, по своим цифрам, а не по таблице курса.

## 9. ДАЛЬШЕ

D.5 The openai SDK as a GLM client — тот же протокол с типами, adapter `LLM` и FakeLLM для тестов без ключа.
