# УРОК D.3 — Node.js for Agents

Блок D · Building Diablo · Прогресс: D.3 / D.10

*Встроенные возможности Node.js, которые нужны agent'у: конфиг из env, таймауты, хэши и подписи, ограниченная параллельность.*

Источник — [Node.js docs](https://nodejs.org/docs/latest/api/): `process`, `crypto`, `AbortSignal`.

## 1. ГДЕ МЫ

Часы курса: 1:40–2:30.

Из D.2 у тебя есть `src/lib/agent/llm.ts` — типы сообщений, ответов и ошибок. Теперь среда исполнения. **Node.js** — runtime, в котором работает серверная часть Diablo: route handlers Next.js, scripts и тесты. Библиотеки ставить не нужно: всё в уроке встроено в Node 24. Программы лежат в `learn/code/D.3/`.

## 2. ИДЕЯ

Agent, который вызывает API тысячи раз, ломается не на логике, а на окружении: ключ не нашёлся, запрос завис навсегда, сотня параллельных вызовов уперлась в rate limit, результат нельзя воспроизвести. Четыре инструмента закрывают эти дыры: env для конфига, AbortSignal для времени, crypto для идентичности и подлинности данных, pool для параллельности.

## 3. МЕХАНИЗМ

| Часть | На какой вопрос отвечает |
|---|---|
| A. Env и конфиг | Где живёт ключ и как не потерять его молча? |
| B. Таймауты | Как не ждать зависший запрос вечно? |
| C. Хэши и подписи | Как доказать, что конфиг тот же, а числа настоящие? |
| D. Ограниченная параллельность | Как быстро, но не превышая лимит? |

### A. Env и конфиг

*«Где живёт ключ?»*

**Суть.** **Environment variables** — пары «имя → строка» процесса: `process.env.ZAI_API_KEY`. Next.js сам читает `.env.local`. Для scripts вне Next — `process.loadEnvFile(".env.local")`, встроено в Node.

**Тонкость.** `??` даёт default только для `undefined`/`null`, а `||` — ещё и для пустой строки. Обязательный секрет не получает default: без него процесс должен упасть сразу с понятным сообщением, а не на сотом запросе.

**Требует.** Один модуль, который читает и проверяет весь конфиг. В D.10 он станет `src/lib/server/env.ts` с `import "server-only"`, чтобы ключ никогда не попал в браузер.

### B. Таймауты

*«Как не ждать вечно?»*

**Суть.** **AbortSignal** — сигнал отмены, который понимают `fetch` и SDK. `AbortSignal.timeout(ms)` срабатывает сам через `ms` и отменяет операцию с ошибкой `TimeoutError`.

**Тонкость.** У reasoning model ответ на `effort: "high"` может идти минуты. Таймаут — не «как можно меньше», а «больше нормального времени ответа и меньше лимита сервера». У route handler в D.10 лимит `maxDuration = 300` секунд.

**Требует.** Таймаут у каждого сетевого вызова, без исключений.

### C. Хэши и подписи

*«Как доказать, что конфиг тот же, а числа настоящие?»*

**Суть.** **Hash** (SHA-256) — отпечаток данных: одинаковые данные дают одинаковый отпечаток. **Canonical JSON** — JSON с отсортированными ключами, чтобы `{a,b}` и `{b,a}` давали один hash. **HMAC** — hash с секретным ключом: подпись, которую нельзя подделать без секрета.

**Тонкость.** В Diablo hash конфига experiment (`configHash`) говорит, какие условия действительно запускались. HMAC-подпись run говорит, что counts произвёл твой сервер, а не отредактировал клиент: state приложения лежит в браузере.

**Требует.** Хэшировать только canonical JSON и никогда не класть HMAC-секрет в код.

### D. Ограниченная параллельность

*«Как быстро, но не превышая лимит?»*

**Суть.** **Pool** — фиксированное число workers, которые по очереди берут задачи из общего списка. Время ≈ задачи / workers, при этом в полёте не больше `limit` запросов.

**Тонкость.** Результаты пишутся по индексу, поэтому их порядок совпадает с порядком входа, хотя заканчиваются задачи вразнобой. Для paired experiment (D.9) это обязательно: ответ на item 17 должен стоять рядом с item 17.

**Требует.** Знать свой rate limit: у Z.ai это лимит одновременных запросов на модель, он виден в консоли.

## 4. ПРИМЕР

Experiment: 60 задач × 2 arms = 120 вызовов target, по 3 секунды каждый.

| Способ | Время | Риск |
|---|---|---|
| `for` + `await` | 120 × 3 = 360 s | дольше `maxDuration` |
| `Promise.all` на 120 | ≈ 3 s | ошибка 1302 (rate limit) на большей части |
| pool на 3 | 120 / 3 × 3 = 120 s | в пределах лимита |

## 5. КОД

Четыре программы, каждая к своей части урока. Запуск: `npx tsx learn/code/D.3/<файл>.ts`.

### 5.1. Конфиг из env (часть A)

```ts
export {};
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}
const model = process.env.GLM_MODEL ?? "glm-5.3";       // ?? — default только для undefined/null
const base = process.env.ZAI_BASE_URL ?? "https://api.z.ai/api/paas/v4/";
console.log({ model, base });
try {
  required("ZAI_API_KEY_THAT_DOES_NOT_EXIST");
} catch (e) {
  console.log("error:", (e as Error).message);
}
```

Что увидишь (без загруженного `.env.local`):

```text
{ model: 'glm-5.3', base: 'https://api.z.ai/api/paas/v4/' }
error: Missing env ZAI_API_KEY_THAT_DOES_NOT_EXIST
```

### 5.2. AbortSignal.timeout (часть B)

```ts
export {};
function slowOperation(signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => resolve("done"), 1000);          // «модель думает» 1 s
    signal.addEventListener("abort", () => { clearTimeout(t); reject(signal.reason); });
  });
}
async function main() {
  try {
    console.log(await slowOperation(AbortSignal.timeout(1500)));
    console.log(await slowOperation(AbortSignal.timeout(200)));
  } catch (e) {
    console.log("aborted:", (e as Error).name);                  // TimeoutError
  }
}
main();
```

Что увидишь:

```text
done
aborted: TimeoutError
```

### 5.3. Canonical JSON, SHA-256 и HMAC (часть C)

```ts
import { createHash, createHmac } from "node:crypto";

function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson((v as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(v);
}
const sha256 = (s: string) => "sha256:" + createHash("sha256").update(s).digest("hex");

const a = { model: "glm-4.7-flash", temperature: 0.3 };
const b = { temperature: 0.3, model: "glm-4.7-flash" };
console.log(sha256(canonicalJson(a)) === sha256(canonicalJson(b)), sha256(canonicalJson(a)).slice(0, 23));

const sign = (data: string) => createHmac("sha256", "dev-secret").update(data).digest("hex").slice(0, 16);
console.log("counts 41/80:", sign('{"k":41,"n":80}'));
console.log("counts 51/80:", sign('{"k":51,"n":80}'));
```

Что увидишь:

```text
true sha256:f71428cb02331f2d
counts 41/80: 1f01b96829d4931c
counts 51/80: 1b81cd06402e79d8
```

Одна изменённая цифра — совсем другая подпись.

### 5.4. Pool с лимитом (часть D)

```ts
export {};
async function mapPool<T, R>(items: readonly T[], limit: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;                 // JS однопоточный: next++ безопасен
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

let inFlight = 0, peak = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
mapPool([1, 2, 3, 4, 5, 6, 7], 3, async (x) => {
  inFlight++; peak = Math.max(peak, inFlight);
  await sleep(50 + (x % 3) * 30);
  inFlight--;
  return x * 10;
}).then((r) => console.log(r, "peak concurrency:", peak));
```

Что увидишь:

```text
[
  10, 20, 30, 40,
  50, 60, 70
] peak concurrency: 3
```

## 6. ТЕРМИНЫ

| English Name | Объяснение |
|---|---|
| Runtime | среда, которая исполняет JavaScript: здесь Node.js |
| Environment variable | именованная строка конфигурации процесса |
| AbortSignal / TimeoutError | сигнал отмены операции / ошибка отмены по таймеру |
| Hash (SHA-256) | короткий отпечаток данных фиксированной длины |
| Canonical JSON | JSON с отсортированными ключами для стабильного hash |
| HMAC | подпись данных секретным ключом |
| Config hash | hash полного конфига experiment: что именно запускалось |
| Pool / Worker | ограниченное множество исполнителей / один исполнитель |
| Concurrency | число операций, идущих одновременно |

## 7. ПРОВЕРКА

1. Почему для `ZAI_API_KEY` нельзя писать `?? "default"`?
2. Чем `??` отличается от `||`, если в `.env.local` написано `GLM_MODEL=` (пусто)?
3. Почему SHA-256 от обычного `JSON.stringify` не годится как config hash?
4. Hash vs HMAC: что доказывает каждый и почему для counts нужен второй?
5. В pool результаты кладутся по индексу. Что сломается в paired experiment, если класть их через `push`?
6. Rate limit Z.ai — 3 одновременных запроса. Какой limit поставишь в pool и почему не 3?
7. Какой таймаут ты дал бы вызову `effort: "high"` и почему?

## 8. ЗАДАНИЕ

30 минут. Напиши сам два файла:

1. `src/lib/exec/hash.ts`: `canonicalJson(value: unknown): string` и `sha256(text: string): string` (результат вида `"sha256:<hex>"`).
2. `src/lib/exec/pool.ts`: `mapPool<T, R>(items, limit, fn)` — порядок результатов равен порядку входа, одновременно не больше `limit`, ошибка в `fn` отклоняет весь `mapPool`.

И один script, `scripts/glm-raw.ts`: сырой `fetch` к Z.ai (как `curl` из D.1) с `AbortSignal.timeout(120_000)`. Ключ берётся из `.env.local` через `process.loadEnvFile`. Script печатает HTTP status, `finish_reason`, `usage` и время в ms. При ошибке он печатает `error.code` из тела ответа.

Готово, когда `npm run typecheck` зелёный, `npx tsx scripts/glm-raw.ts` печатает status 200 и usage, а с испорченным ключом — 401 и код 1000 или 1001.

## 9. ДАЛЬШЕ

D.4 The GLM API — протокол chat completions, reasoning, tokens, деньги и коды ошибок.
