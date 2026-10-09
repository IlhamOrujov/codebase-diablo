# УРОК D.10 — Grounding and the Product: end-to-end и Next.js

Блок D · Building Diablo · Прогресс: D.10 / D.10

*Как LLM объясняет результат, не выдумывая ни одного числа, как замкнуть полный investigation и как отдать его UI через route handlers Next.js.*

Источники — `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` (документация твоей версии Next.js 16.4), `src/lib/data/interpret.ts`.

## 1. ГДЕ МЫ

Часы курса: 8:40–10:00.

DRAFT (D.8) придумывает experiments, runner (D.9) производит counts, `derive.ts` и `validity.ts` дают вердикты и strength. Остался последний LLM-узел — **INTERPRET** — и подключение к продукту. Программы — `learn/code/D.10/`, обе без ключа и без Next.

## 2. ИДЕЯ

Самое опасное место agent — финальный текст: там модель свободно пишет числа, и выдуманное «−18%» выглядит так же убедительно, как настоящее. Решение — **grounding** механически. Код собирает **fact table** (F1 = «Δ −15.0 pp», F2 = «p = 0.012»). Модель пишет текст только с плейсхолдерами `{{F1}}`, `{{F2}}`. Функция проверяет, что в тексте нет ни одной цифры, процента или слова-вердикта вне плейсхолдеров, и подставляет числа сама. Модель объясняет, код отвечает за каждое число. Затем всё это уходит в браузер через сервер: ключ живёт только там.

## 3. МЕХАНИЗМ

| Часть | На какой вопрос отвечает |
|---|---|
| A. Fact table | Какие числа существуют? |
| B. Grounding check | Как доказать, что текст не выдумал число? |
| C. Fallback | Что показать, если модель не справилась? |
| D. Route handlers | Как UI вызывает agent на сервере? |
| E. Секреты и граница сервера | Как ключ не попадает в браузер? |

### A. Fact table

*«Какие числа существуют?»*

**Суть.** `buildFacts(inv)` проходит по завершённым experiments и для каждого создаёт facts с id `F1…Fn`: rate control, rate treatment, Δ (`formatPP`), CI (`formatCIpp`), p (`formatP`), Holm p для primary, n. Каждый fact — `{ id, ref: "E1", label, formatted }`.

**Тонкость.** Числа форматирует код один раз. Модель не видит «сырых» 0.0119…, только готовые строки, и не может их «округлить по-своему».

**Требует.** Facts строятся только из подписанных, завершённых runs (подпись — HMAC из D.3).

### B. Grounding check

*«Как доказать, что число не выдумано?»*

**Суть.** `checkGrounding(text, facts)`:

1. каждый `{{F#}}` существует;
2. после удаления плейсхолдеров и ids (`H1`, `E2`) в тексте нет цифр, `%` и `pp`;
3. нет слов-вердиктов: supported, rejected, proven, significant.

Нарушения уходят в repair loop из D.6 (`check` в `callStructured`).

**Тонкость.** Слова-вердикты запрещены, потому что вердикт считает `verdictFor`, а код рендерит его рядом с объяснением. Иначе модель напишет «supported», когда `verdictFor` сказал «partly-supported». Проверка лексическая: «вдвое больше» прописью она не поймает. Поэтому schema INTERPRET короткая, а вердикт рендерится кодом.

**Требует.** Grounding как `check` в `callStructured` и метрика «сколько раз сработал repair».

### C. Fallback

*«Что показать, если модель не справилась?»*

**Суть.** После `maxRepairs` неудачных попыток Diablo не показывает «почти правильный» текст. Он показывает детерминированное объяснение из `investigationInterpretation(inv)` в `src/lib/data/interpret.ts`: тот же mock-путь, что сейчас в UI.

**Тонкость.** Fallback — честный результат, а не сбой: числа и вердикты те же, теряется только стиль. Частота fallback — метрика качества prompt.

**Требует.** Флаг `usedFallback` в ответе и его показ в UI.

### D. Route handlers

*«Как UI вызывает agent?»*

**Суть.** **Route handler** — файл `src/app/api/<путь>/route.ts`, экспортирующий функцию по HTTP-методу: `export async function POST(req: Request): Promise<Response>`. Тело читается `await req.json()` и валидируется zod: тело запроса — untrusted input. Ответ — `Response.json(data, { status })`. `export const maxDuration = 300` даёт до 300 секунд на запрос.

**Тонкость.** В этом репо включены **Cache Components**. Экспорты `dynamic`, `revalidate`, `fetchCache` и `runtime = "edge"` ломают build — не пиши их. POST-обработчики не кэшируются. Один request = один шаг workflow: draft, run одного experiment, interpret. Длинный investigation — несколько запросов, а не один на 20 минут.

**Требует.** Три маршрута: `POST /api/agent/draft`, `POST /api/experiments/run`, `POST /api/agent/interpret`. Браузер зовёт их `fetch` по тому же origin: CSP проекта разрешает только `connect-src 'self'`.

### E. Секреты и граница сервера

*«Как ключ не попадает в браузер?»*

**Суть.** Файл `src/lib/server/env.ts` начинается с `import "server-only"`. Next.js выдаёт build error, если этот модуль импортирует client component. Ключ читается только там.

**Тонкость.** Пакет `server-only` в репо не установлен: Next обрабатывает этот import сам, а `tsx` и vitest — нет. Поэтому `import "server-only"` стоит только в `env.ts`, а scripts и тесты получают ключ через `process.loadEnvFile` или вообще используют FakeLLM.

**Требует.** Ни одной переменной с ключом с префиксом `NEXT_PUBLIC_`. Live-режим не деплоить на diablo.pnoia.dev, пока нет auth и лимита расходов: иначе любой посетитель тратит твой баланс.

## 4. ПРИМЕР

Facts: F1 = «−15.0 pp» (Δ E1), F2 = «0.012» (p E1). Модель вернула:

- «In E1 accuracy dropped by {{F1}} (p = {{F2}}), consistent with H1.» → 0 нарушений → в UI: «…dropped by −15.0 pp (p = 0.012)…», а рядом код рисует «H1 · Supported».
- «Accuracy dropped by 18% and H1 is clearly supported; see {{F9}}.» → три нарушения: unknown fact F9, free number, verdict word. Они уходят модели в repair. Если и после 2 repairs текст грязный — fallback из `interpret.ts`.

## 5. КОД

Две программы. Запуск: `npx tsx learn/code/D.10/<файл>.ts`.

### 5.1. Facts, checkGrounding, render (части A, B)

```ts
export {};
type Fact = { id: string; label: string; formatted: string };
const facts: Fact[] = [
  { id: "F1", label: "E1 Δ accuracy", formatted: "−15.0 pp" },
  { id: "F2", label: "E1 p (McNemar)", formatted: "0.012" },
];
const VERDICT_WORDS = ["supported", "rejected", "proven", "significant"];

function checkGrounding(text: string): string[] {
  const issues: string[] = [];
  for (const m of text.matchAll(/\{\{(F\d+)\}\}/g)) if (!facts.some((f) => f.id === m[1])) issues.push(`unknown fact ${m[1]}`);
  const bare = text.replace(/\{\{F\d+\}\}/g, "").replace(/\b[HEF]\d+\b/g, "");   // убрали ссылки и ids
  if (/\d|%|\bpp\b/.test(bare)) issues.push("free number in text");
  for (const w of VERDICT_WORDS) if (new RegExp(`\\b${w}\\b`, "i").test(bare)) issues.push(`verdict word "${w}"`);
  return issues;
}
const render = (t: string) => t.replace(/\{\{(F\d+)\}\}/g, (_, id) => facts.find((f) => f.id === id)!.formatted);

const good = "In E1 accuracy dropped by {{F1}} (p = {{F2}}), consistent with H1.";
const bad = "Accuracy dropped by 18% and H1 is clearly supported; see {{F9}}.";
console.log(checkGrounding(good), "→", render(good));
console.log(checkGrounding(bad));
```

Что увидишь:

```text
[] → In E1 accuracy dropped by −15.0 pp (p = 0.012), consistent with H1.
[
  'unknown fact F9',
  'free number in text',
  'verdict word "supported"'
]
```

### 5.2. Route handler и его проверка без Next (часть D)

```ts
import { z } from "zod";

export const maxDuration = 300;            // секунд на запрос (reasoning может думать долго)
const Body = z.object({ question: z.string().min(5).max(2000), systemId: z.string() });

export async function POST(req: Request): Promise<Response> {
  const parsed = Body.safeParse(await req.json().catch(() => null));     // тело запроса — untrusted input
  if (!parsed.success) return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  // здесь: const llm = createZaiLLM({ apiKey: env.ZAI_API_KEY }); const out = await draftInvestigation(llm, parsed.data)
  return Response.json({ ok: true, question: parsed.data.question });
}

// Проверка без Next: вызываем handler как обычную функцию
async function demo() {
  for (const body of [{ question: "Why is v2 worse?", systemId: "helper-v2" }, { question: "?" }]) {
    const res = await POST(new Request("http://x/api/agent/draft", { method: "POST", body: JSON.stringify(body) }));
    console.log(res.status, JSON.stringify(await res.json()));
  }
}
demo();
```

Что увидишь:

```text
200 {"ok":true,"question":"Why is v2 worse?"}
400 {"error":"✖ Too small: expected string to have >=5 characters\n  → at question\n✖ Invalid input: expected string, received undefined\n  → at systemId"}
```

Route handler — обычная функция `Request → Response`, поэтому его можно тестировать vitest'ом без запуска сервера.

## 6. ТЕРМИНЫ

| English Name | Объяснение |
|---|---|
| Grounding | привязка каждого утверждения модели к проверяемому источнику |
| Fact table | пронумерованные числа, посчитанные кодом |
| Placeholder `{{F#}}` | ссылка на fact вместо числа в тексте модели |
| Verdict word | слово-вывод, которое имеет право произносить только код |
| Fallback | детерминированный ответ, если модель не прошла проверку |
| Route handler | функция `Request → Response` в `src/app/api/.../route.ts` |
| `maxDuration` | лимит времени выполнения handler в секундах |
| Cache Components | режим Next.js 16 в этом репо; запрещает экспорты `dynamic`/`revalidate` |
| `server-only` | import, из-за которого модуль нельзя использовать в браузере |
| CSP `connect-src 'self'` | правило: браузер шлёт запросы только на свой origin |
| End-to-end | путь целиком: вопрос → draft → run → stats → объяснение |

## 7. ПРОВЕРКА

1. Почему facts форматирует код, а не модель?
2. Почему в тексте модели запрещены слова-вердикты, даже правильные?
3. Какой выдуманный факт grounding check пропустит, и что его компенсирует?
4. Почему fallback лучше, чем показать текст после второго неудачного repair?
5. Почему один investigation — несколько POST-запросов, а не один?
6. Что произойдёт, если `env.ts` импортирует client component?
7. Почему live-режим нельзя деплоить на публичный домен без auth?
8. Как протестировать route handler, не запуская `next dev`?

## 8. ЗАДАНИЕ

80 минут. Замкни Diablo:

1. `src/lib/agent/facts.ts`: `buildFacts(inv)` на базе `analyzeExperiment` и `holmAdjusted` из `derive.ts`, `checkGrounding(text, facts)`, `renderFacts(text, facts)`.
2. `src/lib/agent/interpreter.ts`: `interpretInvestigation(llm, inv)`. Schema: `{ summary, hypotheses: [{ id, explanation }], caveats }`. `effort: "low"`, `check` = grounding всех текстовых полей. Рендер: summary + строка на hypothesis `H1 · <VERDICT_LABEL из verdictFor> — explanation` + strength из `assess`. При `StructuredError` — `investigationInterpretation(inv)` и `usedFallback: true`.
3. `scripts/investigate.ts "<вопрос>"`: DRAFT (D.8) → для каждого experiment `executePlan` (D.9) → `Run` в Investigation → INTERPRET. Печатает hypotheses, counts, тесты, текст, `usedFallback`, общую стоимость.
4. Сервер: `src/lib/server/env.ts` (`import "server-only"`, ключ и модель) и три route handlers из части D — тонкие обёртки над теми же функциями, с zod-валидацией тела.

Готово, когда `npx tsx scripts/investigate.ts "Why is Helper v2 worse at arithmetic than Helper v1?"` проходит весь путь и печатает объяснение без единого числа вне facts, `npm test` и `npm run typecheck` зелёные, `npx next build` проходит, а `curl -X POST localhost:3000/api/agent/draft` с телом из 5.2 при `npm run dev` возвращает draft.

## 9. ДАЛЬШЕ

После курса, по порядку: LLM-as-a-judge с калибровкой против своих меток (Cohen's kappa) для метрик, которые не проверить regex'ом. Knowledge: findings с provenance, которые становятся priors следующего investigation. Planted-bug benchmark самого Diablo: accuracy, false discovery rate и pass^k на задачах с известной причиной. Только после benchmark — tool calling, свободный agent и self-improvement: без измерения любое «улучшение» непроверяемо.
