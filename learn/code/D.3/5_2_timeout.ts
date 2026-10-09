export {}; // файл — module: свои имена не конфликтуют с другими файлами
// AbortSignal.timeout: любой долгий вызов обрывается по таймеру
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
