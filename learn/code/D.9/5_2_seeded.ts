// Seeded выборка: тот же seed → те же items (воспроизводимость эксперимента)
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
