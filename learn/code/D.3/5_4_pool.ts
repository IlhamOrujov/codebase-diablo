export {}; // файл — module: свои имена не конфликтуют с другими файлами
// mapPool: не больше limit задач одновременно, порядок результатов = порядок входа
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
