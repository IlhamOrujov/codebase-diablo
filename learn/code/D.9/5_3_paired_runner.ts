// Мини-runner: оба arms на каждом item, scorer ставит 0/1, на выходе только counts и b/c
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
