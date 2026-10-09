export {}; // файл — module: свои имена не конфликтуют с другими файлами
// async/await: последовательно vs параллельно
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
async function fakeCall(name: string): Promise<string> {
  await sleep(200);               // как будто запрос к модели на 200 ms
  return `${name}: ok`;
}

async function main() {
  let t = performance.now();
  await fakeCall("a"); await fakeCall("b"); await fakeCall("c");
  console.log("sequential ms ≈", Math.round((performance.now() - t) / 100) * 100);

  t = performance.now();
  const out = await Promise.all([fakeCall("a"), fakeCall("b"), fakeCall("c")]);
  console.log("parallel   ms ≈", Math.round((performance.now() - t) / 100) * 100, out);
}
main();
