# УРОК D.9 — The System Measures: runner и statistics проекта

Блок D · Building Diablo · Прогресс: D.9 / D.10

*Как код, а не модель, проводит experiment над AI system и превращает ответы в counts, а counts — в тест, CI и p-value готовыми модулями проекта.*

Источники — `src/lib/stats.ts` (сверен со SciPy), `src/lib/data/derive.ts`, `src/lib/validity.ts`; Agresti, *Categorical Data Analysis* (McNemar, Newcombe).

## 1. ГДЕ МЫ

Часы курса: 7:20–8:40.

DRAFT (D.8) выдаёт experiments как данные: какой dataset, какой scorer, control и treatment. Теперь вторая половина принципа — **the system measures**. Половина её уже написана: `stats.ts` (тесты и интервалы), `derive.ts` (`analyzeRun`, `verdictFor`, `holmAdjusted`), `validity.ts` (`assess`, rubric C1–C9). Ты пишешь **runner** — код, который вызывает target и производит counts. Программы — `learn/code/D.9/`, все без ключа, импортируют настоящие модули проекта.

## 2. ИДЕЯ

Experiment над AI system — это сравнение двух условий на одних и тех же задачах. Runner делает ровно три вещи: выбирает задачи по seed, вызывает target в обоих arms, ставит каждому ответу 0 или 1 детерминированным scorer'ом. На выходе только counts и **discordant pairs**, никакой интерпретации. Всё остальное — тест, CI, p-value, вердикт по hypothesis, сила доказательства — считает уже существующий код из этих counts, каждый раз заново. Статистика не хранится: её нельзя подделать, можно только пересчитать.

## 3. МЕХАНИЗМ

| Часть | На какой вопрос отвечает |
|---|---|
| A. Targets и allowlist | Что именно мы вызываем и кто это решает? |
| B. Seeded sampling | Как сделать experiment воспроизводимым? |
| C. Paired runner и scorer | Как из ответов получить counts? |
| D. Statistics проекта | Какой тест, какой CI, что значит p? |
| E. Verdict и strength | Как counts становятся выводом? |

### A. Targets и allowlist

*«Что вызываем и кто решает?»*

**Суть.** **Target** — исследуемая система, описанная конфигом: `model`, `system` prompt, `temperature`, `maxTokens`. Все targets живут в серверном реестре (**allowlist**): `helper-v1`, `helper-v2`… Arm в draft — только `targetId` из этого списка.

**Тонкость.** Модель и клиент никогда не передают URL, имя модели или prompt target напрямую. Иначе DRAFT смог бы «вызвать» что угодно, а клиент — превратить сервер в прокси к чужим API (SSRF). Targets в курсе — бесплатные `glm-4.7-flash` и `glm-4.5-flash`: тысячи вызовов за $0.

**Требует.** `resolveArm(arm)` — единственный путь от `targetId` к конфигу, с ошибкой на неизвестный id.

### B. Seeded sampling

*«Как сделать воспроизводимым?»*

**Суть.** **Seed** — число, из которого генератор случайных чисел (`mulberry32` в `stats.ts`) строит одну и ту же последовательность. Fisher–Yates shuffle с seed выбирает одни и те же n задач при каждом запуске.

**Тонкость.** Seed фиксирует выбор задач, но не ответы модели: target недетерминирован. Повтор experiment с новым seed — **replication**. Он проверяет, что эффект не артефакт конкретной выборки.

**Требует.** Seed и hash конфига (D.3) в каждом run — тогда любой результат можно воспроизвести и проверить.

### C. Paired runner и scorer

*«Как получить counts?»*

**Суть.** **Paired design**: каждая задача прогоняется в обоих arms. Для каждой пары считаются **b** (верно только в control) и **c** (верно только в treatment). **Scorer** — детерминированная функция ответа: для арифметики — «последнее `ANSWER: <число>` равно эталону».

**Тонкость.** Paired бесплатно убирает разброс сложности задач. Это видно в 5.4: тот же Δ даёт p = 0.012 paired и p = 0.020 unpaired. Если вызов упал в одном arm, выкидывается вся пара, поэтому runner берёт задачи с запасом (~10%). Ошибка вызова — это не «0», а отсутствие данных.

**Требует.** Pool с лимитом (D.3), `finishReason === "stop"` у каждого ответа и учёт выброшенных пар.

### D. Statistics проекта

*«Какой тест, какой CI?»*

**Суть.** Функции `stats.ts`:

| Функция | Что считает |
|---|---|
| `wilson(k, n)` | 95% CI для одной доли |
| `newcombe(kC, nC, kT, nT)` | 95% CI разницы долей (independent) |
| `twoProportionZ(...)` | p для двух независимых долей |
| `mcnemarExact(b, c)` | точный p для paired design |
| `cohensH(pC, pT)` | размер эффекта |
| `holm(ps)` | поправка p на несколько primary tests |
| `formatP`, `formatPP`, `formatCIpp`, `formatPct` | печать без лишних знаков |

**Тонкость.** Соглашение проекта — «arm 2 минус arm 1»: первым аргументом идёт control, результат = treatment − control. Перепутанный порядок даёт CI с противоположным знаком, а программа не упадёт. Три primary tests по α = 0.05 без поправки дают ~14% шанс хотя бы одной ложной находки. Holm поднимает p так, чтобы общий риск остался 5% (в 5.1 0.03 → 0.060).

**Требует.** Не считать статистику руками: `analyzeRun(run, "paired")` сам выбирает тест и интервал.

### E. Verdict и strength

*«Как counts становятся выводом?»*

**Суть.** `verdictFor(inv, h)` даёт вердикт по hypothesis: supported, partly-supported, rejected или untested — по направлению prediction и CI. `assess(inv, familyOf)` проверяет rubric C1–C9 (достаточно ли n, честен ли scorer, есть ли competing hypothesis) и даёт **evidence strength**: not-enough, weak, moderate или strong.

**Тонкость.** Вердикт и strength считает код, а не LLM. LLM в INTERPRET (D.10) получает их готовыми и может только объяснить словами.

**Требует.** Твой runner возвращает данные в форме `Run` из `types.ts`, тогда весь существующий код и UI работают без изменений.

## 4. ПРИМЕР

80 задач, control `helper-v1`, treatment `helper-v2`. Control верно решил 69, treatment — 57. Из 80 пар 16 верны только у control (b), 4 — только у treatment (c), остальные совпали. Δ = 57/80 − 69/80 = −15.0 pp. Paired McNemar: p = 0.012, CI от −26.3 до −3.8 pp. Ноль не входит в CI → `effectFound: true` → hypothesis «v2 хуже» supported. Ни одно из этих чисел не написала модель.

## 5. КОД

Четыре программы. Запуск: `npx tsx learn/code/D.9/<файл>.ts`.

### 5.1. Функции stats.ts (часть D)

```ts
import { wilson, newcombe, twoProportionZ, mcnemarExact, cohensH, holm, formatP, formatPP, formatCIpp, formatPct } from "@/lib/stats";

const [kC, nC, kT, nT] = [69, 80, 57, 80];          // control 69/80 верно, treatment 57/80
console.log("control  ", formatPct(kC / nC), "CI", wilson(kC, nC).map((x) => formatPct(x)));
console.log("treatment", formatPct(kT / nT), "CI", wilson(kT, nT).map((x) => formatPct(x)));
// Соглашение проекта: arm 1 = control, arm 2 = treatment, результат = treatment − control
console.log("Δ", formatPP(kT / nT - kC / nC), "95% CI", formatCIpp(newcombe(kC, nC, kT, nT)));
console.log("unpaired z-test", formatP(twoProportionZ(kC, nC, kT, nT).p));
// Paired: те же 80 items в обоих arms. b = верно только в control, c = верно только в treatment
const [b, c] = [16, 4];
console.log("paired McNemar ", formatP(mcnemarExact(b, c)), "| Cohen's h", cohensH(kC / nC, kT / nT).toFixed(2));
console.log("Holm for 3 primary p:", holm([0.012, 0.03, 0.2]).map((p) => formatP(p)));
```

Что увидишь:

```text
control   86.3% CI [ '77.0%', '92.1%' ]
treatment 71.3% CI [ '60.5%', '80.0%' ]
Δ −15.0 pp 95% CI −27.2 to −2.3
unpaired z-test p = 0.020
paired McNemar  p = 0.012 | Cohen's h -0.37
Holm for 3 primary p: [ 'p = 0.036', 'p = 0.060', 'p = 0.20' ]
```

### 5.2. Seeded sampling (часть B)

```ts
import { mulberry32 } from "@/lib/stats";

function sampleItems<T>(items: readonly T[], n: number, seed: number): T[] {
  const rnd = mulberry32(seed);
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {            // Fisher–Yates
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}
const ids = Array.from({ length: 20 }, (_, i) => `q${i + 1}`);
console.log(sampleItems(ids, 5, 42));
console.log(sampleItems(ids, 5, 42));
console.log(sampleItems(ids, 5, 7));
```

Что увидишь:

```text
[ 'q14', 'q1', 'q20', 'q5', 'q7' ]
[ 'q14', 'q1', 'q20', 'q5', 'q7' ]
[ 'q10', 'q20', 'q8', 'q5', 'q6' ]
```

### 5.3. Мини paired runner (часть C)

```ts
import { mcnemarExact, formatP, mulberry32 } from "@/lib/stats";

type Item = { id: string; a: number; b: number };
const items: Item[] = Array.from({ length: 60 }, (_, i) => ({ id: `q${i}`, a: 10 + i, b: 7 * i }));
const rnd = mulberry32(1);
// Два «target»: v1 ошибается в ~10% случаев, v2 — в ~30% (вместо API — детерминированный фейк)
const target = (errRate: number) => (it: Item) => `ANSWER: ${it.a + it.b + (rnd() < errRate ? 1 : 0)}`;
const arms = { control: target(0.1), treatment: target(0.3) };
const score = (resp: string, it: Item): 0 | 1 => (Number(/ANSWER:\s*(-?\d+)/.exec(resp)?.[1]) === it.a + it.b ? 1 : 0);

const counts = { control: { k: 0, n: 0 }, treatment: { k: 0, n: 0 } };
let b = 0, c = 0;
for (const it of items) {
  const sc = score(arms.control(it), it), st = score(arms.treatment(it), it);
  counts.control.k += sc; counts.control.n++;
  counts.treatment.k += st; counts.treatment.n++;
  if (sc === 1 && st === 0) b++;                      // discordant pairs
  if (sc === 0 && st === 1) c++;
}
console.log(counts, { b, c }, "McNemar", formatP(mcnemarExact(b, c)));
```

Что увидишь:

```text
{ control: { k: 57, n: 60 }, treatment: { k: 37, n: 60 } } { b: 22, c: 2 } McNemar p < 0.001
```

### 5.4. analyzeRun проекта на Run (части D, E)

```ts
import { analyzeRun } from "@/lib/data/derive";
import type { Run } from "@/lib/data/types";
import { formatCIpp, formatP, formatPP } from "@/lib/stats";

const run: Run = {
  id: "inv-1/E1/primary-1", experimentId: "E1", role: "primary",
  startedAt: "2026-10-09T10:00:00.000Z", finishedAt: "2026-10-09T10:02:00.000Z", expectedDurationMs: 120_000,
  counts: { control: { k: 69, n: 80 }, treatment: { k: 57, n: 80 } },   // единственное, что пишет runner
  discordant: { b: 16, c: 4 },                                          // paired: те же 80 items
  sweep: null, grid: null, modelVersion: "glm-4.7-flash", params: { seed: "42" },
  datasetHash: null, configHash: null, tokens: null, costUsd: 0, samples: [], traces: [],
};
for (const pairing of ["paired", "independent"] as const) {
  const r = analyzeRun(run, pairing)!;
  console.log(pairing.padEnd(11), r.test.padEnd(22), "Δ", formatPP(r.diff), "CI", formatCIpp(r.diffCI), formatP(r.p), "| effectFound:", r.effectFound);
}
```

Что увидишь:

```text
paired      Exact McNemar test     Δ −15.0 pp CI −26.3 to −3.8 p = 0.012 | effectFound: true
independent Two-proportion z-test  Δ −15.0 pp CI −27.2 to −2.3 p = 0.020 | effectFound: true
```

## 6. ТЕРМИНЫ

| English Name | Объяснение |
|---|---|
| Runner / Executor | код, который проводит experiment и возвращает counts |
| Allowlist / Registry | серверный список разрешённых targets, datasets, scorers |
| Seed / Replication | число, фиксирующее выборку / повтор experiment с новым seed |
| Paired design / Discordant pairs (b, c) | те же items в обоих arms / пары с разным результатом |
| Scorer | детерминированная функция «ответ → 0 или 1» |
| Counts (k / n) | число успехов / число задач в arm |
| p-value / α | вероятность такого или большего эффекта при отсутствии эффекта / порог 0.05 |
| Confidence interval (CI) | диапазон правдоподобных значений эффекта |
| McNemar test | точный тест для paired бинарных данных по b и c |
| Effect size (Cohen's h) | масштаб эффекта, не зависящий от n |
| Multiple comparisons / Holm | рост ложных находок при многих тестах / поправка на это |
| Evidence strength | итоговая сила доказательства по rubric C1–C9 |

## 7. ПРОВЕРКА

1. Почему DRAFT указывает `targetId`, а не имя модели и prompt?
2. Seed одинаковый, а результаты двух запусков разные. Почему, и что это говорит о target?
3. Почему при ошибке в одном arm выкидывается вся пара, а не ставится 0?
4. В 5.4 Δ одинаковый, а p разный. Откуда разница?
5. Что изменится в 5.1, если вызвать `newcombe(kT, nT, kC, nC)`? Почему код не упадёт?
6. b = 3, c = 3, Δ = 0. Что скажет McNemar и почему этого достаточно?
7. Три primary experiment дали p = 0.012, 0.03 и 0.2. Какие останутся значимыми после Holm?
8. Почему вердикт по hypothesis считает `verdictFor`, а не LLM?

## 8. ЗАДАНИЕ

60 минут. Напиши сам measuring half:

1. `scripts/make-datasets.ts` → `src/lib/exec/datasets/arith-v1.json`: 400 задач `{ id, prompt, answer, split: "explore" | "confirm" }`, по 200 в каждом split. Генерация по seed, например «(a + b) × c − d».
2. `src/lib/exec/targets.ts`:
   - `TARGETS`: `helper-v1` — `glm-4.7-flash`, prompt «Solve step by step. End with: ANSWER: <integer>.», temperature 0.3;
   - `helper-v2` — тот же `model`, но два отличия: короткий prompt «Reply with one line only: ANSWER: <integer>.» и temperature 0.9;
   - `resolveArm(arm)`, `configDiff(a, b)` — какие поля конфига отличаются.
3. `src/lib/exec/items.ts`: `loadItems(datasetId)` и `sampleItems(items, n, seed, split = "confirm")`.
4. `src/lib/exec/scorers.ts`: `scoreRule("answer-tag", response, item)` — последнее `ANSWER:` совпадает с эталоном.
5. `src/lib/exec/runner.ts`: `executePlan(llm, plan, runId)` → `{ counts, discordant, errors, droppedPairs, costUsd, configHash }`. Внутри: `sampleItems` с запасом 10%, pool на 3, вызовы target через `llm.chat({ model, messages, temperature, maxTokens })`, выброс пары при ошибке или `finishReason ≠ "stop"`, первые `nPerArm` полных пар.
6. `scripts/run-once.ts`: helper-v1 vs helper-v2, `nPerArm = 60`, затем `analyzeRun` на собранном `Run` (как в 5.4). Печатает counts, b, c, droppedPairs и строку теста.

Если flash-модель долго думает, добавь в `ChatRequest` поле `thinking` и передавай `{ type: "disabled" }` для target. Проверь реакцию API на своём ключе: docs не гарантируют этот режим для каждой flash-модели.

Готово, когда `run-once.ts` печатает реальные counts и `Exact McNemar test` с p, тот же seed даёт тот же список item ids, а тест runner'а на FakeLLM (target отвечает по функции от item) зелёный.

## 9. ДАЛЬШЕ

D.10 Grounding and the Product — объяснение без выдуманных чисел, end-to-end investigation и route handlers Next.js для UI.
