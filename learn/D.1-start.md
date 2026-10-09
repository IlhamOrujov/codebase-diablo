# УРОК D.1 — Diablo as an Agent: карта проекта и старт

Блок D · Building Diablo · Прогресс: D.1 / D.10

*Что именно ты строишь, из каких частей состоит проект и как за 40 минут получить рабочее окружение и первый ответ GLM-5.3.*

Опора — глава 2 [AIMA](http://aima.cs.berkeley.edu/4th-ed/pdfs/newchap02.pdf) (урок 0.2) и [docs.z.ai](https://docs.z.ai/api-reference/llm/chat-completion).

## 1. ГДЕ МЫ

Часы курса: 0:00–0:40 из 10:00.

Из 0.2 ты знаешь: agent описывают через **PEAS**, environment — через семь осей, а **learning agent** состоит из performance element, critic, learning element и problem generator. В репо `~/diablo-ai` уже есть UI, data layer и половина Diablo, которая измеряет: `src/lib/stats.ts`, `src/lib/data/derive.ts`, `src/lib/validity.ts`. Половина, которая рассуждает, — заглушка: `designInvestigation` в `src/lib/data/mock/agent.ts`. Курс учит тебя написать настоящую.

## 2. ИДЕЯ

Diablo — agent, чей environment — другая AI system. Её поведение скрыто, ответы случайны, правила неизвестны. Значит, рассуждения LLM сами по себе ничего не доказывают: доказывает только измерение. Отсюда главный принцип проекта — **«The AI reasons. The system measures.»** LLM предлагает hypotheses и experiments и объясняет результат. Код запускает эксперименты, считает статистику и проверяет, что LLM не выдумала ни одного числа. Весь курс — это способы провести эту границу в коде.

## 3. МЕХАНИЗМ

| Часть | На какой вопрос отвечает |
|---|---|
| A. Diablo как agent | Что Diablo видит, делает и чем измеряется? |
| B. Две половины проекта | Что пишет LLM и что пишет код? |
| C. Карта репо и стек | Где что лежит и какие библиотеки ты выучишь? |

### A. Diablo как agent

**PEAS для Diablo**

| | Diablo |
|---|---|
| P — performance measure | верная причина найдена; доля ложных «открытий»; ноль выдуманных чисел; $ и время на investigation |
| E — environment | target AI system за API, datasets, budget, rate limits Z.ai |
| A — actuators | вызовы target, сообщения пользователю, записи findings |
| S — sensors | вопрос; ответы target, usage, latency; scores |

**Семь осей.** Partially observable (причина скрыта), stochastic (одинаковый запрос даёт разные ответы), sequential (следующий experiment зависит от прошлого), semi-dynamic (мир ждёт, но budget тает), discrete (выбор из конечного списка targets и datasets), single-agent (target не играет против), unknown (законы target узнаются только опытом).

**Требует.** Partially observable + stochastic → выборка и статистика, а не один пример. Unknown → experiment, а не рассуждение.

**Тип agent.** Learning agent. Performance element — LLM, которая предлагает experiments. Critic — `stats.ts` + `validity.ts`. Performance standard — α = 0.05 и rubric C1–C9 в `validity.ts`, зафиксированные вне LLM.

### B. Две половины проекта

*«Кто отвечает за что?»*

**Суть.** **Reasoning half** — LLM-узлы: DRAFT (hypotheses + experiments как typed objects) и INTERPRET (объяснение результата). **Measuring half** — детерминированный код: runner вызывает target, scorer ставит 0/1, `stats.ts` считает p-value и CI.

**Тонкость.** Это не пожелание в prompt, а архитектура: LLM физически не имеет пути записать число в результат. Числа в её тексте проверяет функция (урок D.10).

**Требует.** Чётких interfaces между половинами: LLM возвращает только JSON, который проходит schema (D.6), код возвращает только counts.

### C. Карта репо и стек

**Суть.** Проект — **Next.js 16** (App Router) на **TypeScript**. Код, который ты пишешь, живёт в `src/lib/agent` (reasoning), `src/lib/exec` (measuring), `src/app/api` (сервер для UI), `scripts` (запуск из терминала).

| Библиотека | Зачем в Diablo | Урок |
|---|---|---|
| TypeScript | типы для сообщений, ошибок, результатов | D.2 |
| Node.js (fetch, crypto, env) | HTTP, хэши, ключи, параллельность | D.3 |
| GLM API (Z.ai) | reasoning model `glm-5.3` | D.4 |
| `openai` SDK | официальный путь Z.ai для Node | D.5 |
| `zod` | проверка JSON от модели | D.6 |
| `vitest` | тесты без ключа и без денег | D.7 |
| tool calling / workflow | архитектура agent | D.8 |
| `stats.ts`, `derive.ts`, `validity.ts` | measuring half проекта | D.9 |
| Next.js route handlers | подключение к UI | D.10 |
| `tsx` | запуск `.ts` файлов без сборки | везде |

**Тонкость.** В этом репо Next.js новее твоих знаний: документация лежит в `node_modules/next/dist/docs/`, и при сомнениях читать нужно её.

## 4. ПРИМЕР

Вопрос: «Почему Helper v2 решает арифметику хуже v1?» В v2 изменили два параметра: короче system prompt и выше temperature.

1. DRAFT (LLM): H1 «виноват prompt», H2 «виновата temperature» (competing); E1 меняет только prompt, E2 — только temperature.
2. RUN (код): каждый experiment гоняет одни и те же 80 задач в двух arms и считает верные ответы.
3. ANALYZE (код): E1 даёт Δ −15.0 pp при p = 0.012, а у E2 эффекта нет.
4. INTERPRET (LLM): объясняет, ссылаясь на числа как на `{{F1}}`. Код подставляет числа и проверяет, что других чисел в тексте нет.

Модель ни разу не произнесла «−15.0 pp» сама — это и есть принцип проекта.

## 5. КОД

Три шага в терминале, все из `~/diablo-ai`.

### 5.1. Ветка и точка отсчёта

```bash
cd ~/diablo-ai
git switch -c agent/glm
npm test
```

Что увидишь: `Tests  43 passed (43)`. Это baseline: после каждого урока тесты снова зелёные. `npm run typecheck` запустишь после 5.2: программы курса в `learn/code` импортируют `openai`, которого ещё нет.

### 5.2. Ключ и зависимости

На z.ai пополни **pay-as-you-go** balance ($10 хватит) и создай ключ на https://z.ai/manage-apikey/apikey-list. Ключ **GLM Coding Plan** не подходит: его разрешено использовать только внутри coding tools.

Допиши в `.env.local`, не трогая строки, которые там уже есть:

```bash
ZAI_API_KEY=твой_ключ
GLM_MODEL=glm-5.3
ZAI_BASE_URL=https://api.z.ai/api/paas/v4/
```

Без префикса `NEXT_PUBLIC_`: такой префикс отправил бы ключ в браузер. Затем:

```bash
npm i openai@7.30.1 && npm i -D tsx
npm run typecheck
```

Что увидишь: typecheck без ошибок.

### 5.3. Первый вызов — сырой HTTP

```bash
export ZAI_API_KEY=$(grep '^ZAI_API_KEY=' .env.local | cut -d= -f2-)
curl -sS https://api.z.ai/api/paas/v4/chat/completions \
  -H "Authorization: Bearer $ZAI_API_KEY" -H 'Content-Type: application/json' \
  -d '{"model":"glm-5.3","reasoning_effort":"low","max_tokens":1024,"messages":[{"role":"user","content":"Reply with OK."}]}'
```

Что увидишь: JSON, в котором `choices[0].message.content` — «OK», `reasoning_content` — скрытые рассуждения модели, `finish_reason` — `"stop"`, `usage` — число tokens. Точные числа у каждого вызова свои. Ошибка с кодом 1211 значит «unknown model»: поставь `GLM_MODEL=glm-5.2`.

## 6. ТЕРМИНЫ

| English Name | Объяснение |
|---|---|
| Reasoning half / Measuring half | часть Diablo, где думает LLM / часть, где измеряет код |
| Target (AI system) | исследуемая система: модель, agent или приложение |
| Investigation | одно исследование: вопрос → hypotheses → experiments → вывод |
| Hypothesis / Competing hypothesis | проверяемое объяснение / альтернативное объяснение того же эффекта |
| Experiment / Arm | сравнение двух условий / одно условие: control или treatment |
| App Router | способ организации Next.js-приложения папками в `src/app` |
| Pay-as-you-go | оплата по факту использования API |
| `.env.local` | файл с секретами, который не попадает в git |

## 7. ПРОВЕРКА

1. Почему для Diablo environment unknown, даже если ты знаешь, как устроен target внутри?
2. Что в Diablo играет роль critic, а что — performance standard? Почему они не внутри LLM?
3. Что сломается, если LLM будет сама писать p-value в отчёт? Приведи сценарий.
4. Почему в v2 из ПРИМЕРА нужны два experiment, а не одно сравнение v1 и v2?
5. Чем опасен префикс `NEXT_PUBLIC_` у ключа?
6. Какую часть проекта ты бы проверил первой, если Diablo выдал вывод, противоречащий числам?

## 8. ЗАДАНИЕ

20 минут. Создай `learn/my/D.1.md` и ответь пятью блоками:

1. PEAS Diablo своими словами, по одной строке на букву.
2. Семь осей environment: полюс и одно предложение «почему».
3. Список файлов `src/lib/data/mock/agent.ts` и `src/lib/data/mock/simulate.ts`: какие функции ты заменишь и что каждая возвращает. Открой и прочитай их.
4. Вывод своего `curl` из 5.3: content, finish_reason, usage.
5. Одна hypothesis про любую свою AI system (например, OrujovAI tutor) и experiment, который отличит её от competing hypothesis.

Готово, когда 43 теста зелёные, `curl` вернул `"finish_reason":"stop"` и файл заполнен.

## 9. ДАЛЬШЕ

D.2 TypeScript for Diablo — типы, на которых будет держаться весь agent: unions, generics, async и свои ошибки.
