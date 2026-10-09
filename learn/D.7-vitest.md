# УРОК D.7 — vitest: тесты для agent без ключа

Блок D · Building Diablo · Прогресс: D.7 / D.10

*Как тестировать код вокруг LLM детерминированно, бесплатно и быстро, и что именно тестировать.*

Источник — [vitest docs](https://vitest.dev/guide/).

## 1. ГДЕ МЫ

Часы курса: 5:25–6:10.

У тебя есть port `LLM`, adapter, `FakeLLM` (D.5) и `callStructured` (D.6). В репо уже настроен **vitest** v5: `vitest.config.mts` ищет файлы `src/**/*.test.ts` и понимает alias `@/`. Команда `npm test` гоняет все 43 существующих теста. Пример урока — `learn/code/D.7/example.test.ts`. Чтобы запустить, скопируй его в `src/lib/learn/example.test.ts`.

## 2. ИДЕЯ

Agent состоит из двух видов кода. Модель недетерминирована, медленна и стоит денег. Код вокруг неё (сборка messages, repair, классификация ошибок, статистика, grounding) должен вести себя одинаково всегда. Unit tests проверяют именно второй вид, подменяя модель на FakeLLM. Тогда каждая ветка — repair, ошибка, обрыв, лимит — гарантированно выполняется за миллисекунды. Качество самой модели проверяется отдельно, benchmark'ом (D.10).

## 3. МЕХАНИЗМ

| Часть | На какой вопрос отвечает |
|---|---|
| A. Анатомия теста | Как устроен тест в vitest? |
| B. Async и ошибки | Как тестировать Promise и исключения? |
| C. Что тестировать в agent | Какие тесты действительно ловят баги? |
| D. Тест, который может упасть | Как убедиться, что тест вообще что-то проверяет? |

### A. Анатомия теста

*«Как устроен тест?»*

**Суть.** `describe("unit", () => { it("behaviour", () => { expect(actual).toBe(expected) }) })`. Matchers: `toBe` (===), `toEqual` (глубокое равенство объектов), `toBeLessThan`, `toHaveLength`, `toThrow`. Имя `it` формулируется как поведение: «repairs once, then succeeds».

**Тонкость.** `toBe` для объектов сравнивает ссылки, а не содержимое. Для `{ n: 3 }` нужен `toEqual`.

**Требует.** Один `it` — одно поведение. Иначе по красному тесту не понять, что сломалось.

### B. Async и ошибки

*«Как тестировать Promise?»*

**Суть.** `it("…", async () => { expect(await f()).toEqual(...) })`. Для ожидаемого отказа: `await expect(f()).rejects.toThrow("text")`, для успеха — `.resolves`.

**Тонкость.** Без `await` перед `expect(...).rejects` тест закончится раньше проверки и пройдёт всегда. Это классическая ловушка: зелёный тест, который ничего не проверил.

**Требует.** `await` у каждого async expect.

### C. Что тестировать в agent

*«Какие тесты ловят баги?»*

**Суть.** Тестируй границы и отказы, а не счастливый путь:

| Модуль | Что проверить |
|---|---|
| `zai.ts` | `classifyZaiError` по таблице кодов: 1302 → rate_limit, 1113 → balance |
| `fake-llm.ts` | бросает заданную Error; «no reply» после конца списка |
| `structured.ts` | 0 repairs; 1 repair; StructuredError после 1 + maxRepairs; `length` → без repair |
| `structured.ts` | что именно ушло в модель: `fake.calls[1].messages` содержит issues |
| `stats.ts` (готов) | известные значения: McNemar(0,0) = 1 |

**Тонкость.** Проверка `fake.calls` — это проверка протокола, а не результата: отправил ли код модели ошибки, сохранил ли system prompt, включил ли `json: true`.

**Требует.** На каждую ветку `if` в agent-коде — хотя бы один тест.

### D. Тест, который может упасть

*«Проверяет ли тест что-нибудь?»*

**Суть.** Тест полезен, только если он краснеет при поломке. Проверка — **mutation**: намеренно сломай код (например, `maxRepairs + 1` вместо `maxRepairs`) и убедись, что нужный тест упал.

**Тонкость.** Зелёный набор после mutation значит, что поведение не покрыто, хотя coverage может показывать 100%: строка выполнилась, но результат никто не проверил.

**Требует.** После каждого нового модуля — одна ручная mutation.

## 4. ПРИМЕР

Баг: в `callStructured` цикл идёт `attempt < maxRepairs` вместо `<=`. При `maxRepairs = 2` модель вызывается 2 раза, а не 3. Тест «gives up after 1 + maxRepairs calls» с `expect(err.calls).toHaveLength(3)` ловит это сразу. Без него баг проявится в проде как «Diablo сдаётся раньше времени», и ты будешь искать причину в prompt, а не в счётчике.

## 5. КОД

Одна программа: тестовый файл. Скопируй её в `src/lib/learn/example.test.ts` и запусти `npx vitest run src/lib/learn`.

### 5.1. Тесты с FakeLLM и с готовым stats.ts (части A, B, C)

```ts
import { describe, expect, it } from "vitest";
import { mcnemarExact } from "@/lib/stats";

// Тестируем код, а не модель: FakeLLM отдаёт заранее заданные ответы
class FakeLLM {
  calls = 0;
  constructor(private replies: string[]) {}
  async chat(): Promise<string> {
    const r = this.replies[this.calls++];
    if (r === undefined) throw new Error("FakeLLM: no reply");
    return r;
  }
}
async function askJson(llm: FakeLLM): Promise<{ n: number }> {
  for (let i = 0; i < 2; i++) {
    try { return JSON.parse(await llm.chat()); } catch { /* один repair */ }
  }
  throw new Error("invalid JSON twice");
}

describe("askJson", () => {
  it("parses valid JSON in one call", async () => {
    const llm = new FakeLLM(['{"n":3}']);
    expect(await askJson(llm)).toEqual({ n: 3 });
    expect(llm.calls).toBe(1);
  });
  it("repairs once, then succeeds", async () => {
    const llm = new FakeLLM(["not json", '{"n":4}']);
    await expect(askJson(llm)).resolves.toEqual({ n: 4 });
    expect(llm.calls).toBe(2);
  });
  it("gives up after two bad replies", async () => {
    await expect(askJson(new FakeLLM(["x", "y"]))).rejects.toThrow("invalid JSON twice");
  });
});

describe("project stats", () => {
  it("McNemar: no discordant pairs → p = 1", () => {
    expect(mcnemarExact(0, 0)).toBe(1);
  });
  it("McNemar: 16 vs 4 is below α = 0.05", () => {
    expect(mcnemarExact(16, 4)).toBeLessThan(0.05);
  });
});
```

Что увидишь:

```text
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

### 5.2. Mutation (часть D)

Замени в `askJson` `i < 2` на `i < 1` и запусти снова.

Что увидишь: `repairs once, then succeeds` красный (`invalid JSON twice`), остальные 4 зелёные. Значит, тест реально покрывает repair. Верни `i < 2`.

## 6. ТЕРМИНЫ

| English Name | Объяснение |
|---|---|
| Unit test | проверка одного модуля в изоляции |
| `describe` / `it` / `expect` | группа тестов / один тест / проверка значения |
| Matcher (`toBe`, `toEqual`, `toThrow`) | правило сравнения в `expect` |
| `resolves` / `rejects` | проверка успешного / отклонённого Promise |
| Deterministic test | тест, который всегда даёт один результат |
| Mutation testing | намеренная поломка кода, чтобы проверить, что тест её ловит |
| Coverage | доля строк, выполненных тестами (не равна доле проверенного поведения) |
| Benchmark | измерение качества всей системы на наборе задач (D.10) |

## 7. ПРОВЕРКА

1. Почему в unit tests Diablo нет настоящего GLM?
2. Чем `toBe` отличается от `toEqual` на объекте `{ n: 3 }`?
3. Что произойдёт с тестом без `await` перед `expect(...).rejects`?
4. Какой тест поймает баг «repair-сообщение не содержит ошибок»?
5. Coverage 100%, а mutation не поймана. Как это возможно?
6. Что проверяет `fake.calls`, чего не проверяет возвращённое значение?
7. Какой один тест ты написал бы первым для `classifyZaiError` и почему?

## 8. ЗАДАНИЕ

35 минут. Напиши сам два тестовых файла для своих модулей:

1. `src/lib/agent/llm.test.ts`: `classifyZaiError` (минимум 6 случаев из таблицы D.4) и `FakeLLM` (ответ строкой, бросок Error, «no reply», запись `calls`).
2. `src/lib/agent/structured.test.ts`: четыре сценария `callStructured` из ЗАДАНИЯ D.6, плюс проверка, что во втором вызове `fake.calls[1].messages` последним сообщением содержит текст ошибки. Плюс тест `finishReason: "length"` → `StructuredError` после одного вызова.

Затем сделай одну mutation в `structured.ts` и убедись, что упал нужный тест.

Готово, когда `npm test` показывает 43 + твои тесты (не меньше 14 новых), все зелёные, без `ZAI_API_KEY` в окружении (`env -u ZAI_API_KEY npm test`), а mutation ловится.

## 9. ДАЛЬШЕ

D.8 Agent Architecture — tool calling, agent loop, workflow и почему ядро Diablo — workflow с тремя LLM-узлами.
