export {}; // файл — module: свои имена не конфликтуют с другими файлами
// Generic Result<T>: успех или ошибка, без исключений
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function parseNumber(s: string): Result<number> {
  const n = Number(s);
  return Number.isFinite(n) ? { ok: true, value: n } : { ok: false, error: `not a number: ${s}` };
}

function firstOk<T>(results: Result<T>[]): T | null {   // T выводится из аргумента
  for (const r of results) if (r.ok) return r.value;
  return null;
}

const rs = ["abc", "42", "7"].map(parseNumber);
console.log(rs);
console.log("first ok:", firstOk(rs));
