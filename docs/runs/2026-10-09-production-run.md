# First real run on production, 9 Oct 2026

Run on https://app.diablo.pnoia.dev through `POST /api/live/run`. Reasoning model **claude-opus-5-5**; system under test **claude-haiku-4-5-20251001**. 123 model calls, 63 s. Full event stream: [`2026-10-09-production-run.json`](2026-10-09-production-run.json). No keys appear in it.

| Experiment | Change | v1 correct | treatment correct | Discordant pairs |
|---|---|---|---|---|
| E1 | Prompt only: full vs short at temperature 0.2 | 40/40 | 0/40 | b=40, c=0 |
| E2 | Temperature only: 0.2 vs 1.0 with full prompt | 40/40 | 39/40 | b=1, c=0 |

**Conclusion, as published after the grounding check:**

> The shortened system prompt explains the accuracy drop: in E1, accuracy on 40 paired items fell from 100.0% to 0.0%, a difference of −100.0 pp (95% CI −100.0 to −100.0 pp; p < 0.001), so the verdict on H1 is supported. Raising the temperature from 0.2 to 1.0 in E2 moved accuracy from 100.0% to 97.5% (−2.5 pp, 95% CI −7.5 to 0.0 pp, p > 0.99), but the outcome was no clear effect (the interval includes zero), so this is not evidence of an effect and the verdict on H2 is rejected. A small temperature effect is still not ruled out at this sample size, and overall evidence strength is Moderate · effect found. Next, restore the step-by-step working instruction in the short prompt and re-run the paired comparison, and run a larger temperature test if the higher setting is meant to stay.

**Grounding check:** interpretation attempt 1 was rejected (A quantity word (“zero”) was written; cite the number from the fact table instead.); attempt 2 passed. Every number above comes from code (exact McNemar, paired bootstrap, Holm), not from the model.

An earlier run the same afternoon, on the easier helper-arithmetic-v1 items, put every arm at 100%. Diablo reported "no measurable effect" and flagged that the items were at ceiling. That is why the testbed was made harder (#21).
