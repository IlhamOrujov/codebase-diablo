# Блок D — Building Diablo

Блок D · Building Diablo · 10 уроков · 10 часов

*Курс, после которого ты сам пишешь reasoning half Diablo на GLM-5.3: каждая библиотека проекта — отдельный урок в формате 0.2, каждое ЗАДАНИЕ — кусок настоящего кода Diablo.*

## Как устроен каждый урок

Как 0.2: ГДЕ МЫ → ИДЕЯ → МЕХАНИЗМ (части A, B, C… с Суть / Тонкость / Требует) → ПРИМЕР → КОД → ТЕРМИНЫ → ПРОВЕРКА → ЗАДАНИЕ → ДАЛЬШЕ.

- **КОД** — короткие самостоятельные программы, каждая к своей части урока. Лежат в `learn/code/D.x/`, запускаются `npx tsx learn/code/D.x/<файл>.ts` из корня репо. Все, кроме помеченных «нужен ключ», прогнаны, и «Что увидишь» — их реальный вывод.
- **ЗАДАНИЕ** — ты сам пишешь файл Diablo по спецификации. Решений в курсе нет.

## Карта

| Урок | Часы | Чему учит | Что ты пишешь в ЗАДАНИИ |
|---|---|---|---|
| [D.1 Diablo as an Agent](D.1-start.md) | 0:00–0:40 | PEAS Diablo, архитектура, стек, первый `curl` | окружение, ключ, PEAS |
| [D.2 TypeScript](D.2-typescript.md) | 0:40–1:40 | unions, generics, async, ошибки | `src/lib/agent/llm.ts` |
| [D.3 Node.js](D.3-node.md) | 1:40–2:30 | env, timeouts, hash/HMAC, pool | `exec/hash.ts`, `exec/pool.ts`, `scripts/glm-raw.ts` |
| [D.4 GLM API](D.4-glm-api.md) | 2:30–3:25 | протокол, reasoning, tokens, цены, коды ошибок | `agent/pricing.ts`, `scripts/glm-hello.ts` |
| [D.5 openai SDK](D.5-openai-sdk.md) | 3:25–4:25 | клиент SDK, port/adapter, FakeLLM | `agent/zai.ts`, `agent/fake-llm.ts` |
| [D.6 zod](D.6-zod-structured-output.md) | 4:25–5:25 | schemas, JSON mode, repair loop | `agent/structured.ts` |
| [D.7 vitest](D.7-vitest.md) | 5:25–6:10 | тесты без ключа, mutation | `llm.test.ts`, `structured.test.ts` |
| [D.8 Agent Architecture](D.8-agent-architecture.md) | 6:10–7:20 | tool calling, ReAct, workflow, budgets | DRAFT: `schemas.ts`, `prompts.ts`, `drafter.ts` |
| [D.9 System Measures](D.9-system-measures.md) | 7:20–8:40 | targets, seed, paired runner, `stats.ts` / `derive.ts` / `validity.ts` | `exec/*`, `scripts/run-once.ts` |
| [D.10 Grounding & Product](D.10-grounding-and-product.md) | 8:40–10:00 | fact table, grounding, fallback, route handlers | INTERPRET, `investigate.ts`, `/api/*` |

## С чего начать прямо сейчас

1. Открой [D.1](D.1-start.md) и сделай раздел КОД: ветка `agent/glm`, `npm test` (43 зелёных), ключ Z.ai **pay-as-you-go** в `.env.local`, `npm i openai@7.30.1 && npm i -D tsx`, первый `curl`.
2. Дальше строго по порядку: каждое ЗАДАНИЕ использует файлы из предыдущих.
3. После каждого урока: `npm run typecheck && npm test` зелёные, коммит.

## Если отстаёшь

Не пропускай D.5, D.6, D.9 и D.10: это ядро Diablo. D.7 можно сократить до тестов `structured.ts`. Если ключ не оплачен, D.2, D.3, D.6 и D.7 целиком идут без него.

## Главный принцип

**The AI reasons. The system measures.** LLM предлагает hypotheses и experiments (D.8) и объясняет результат (D.10). Код вызывает target, ставит 0/1, считает статистику (D.9) и проверяет, что в объяснении нет ни одного числа, которое он не посчитал сам (D.10).
