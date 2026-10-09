export {}; // файл — module: свои имена не конфликтуют с другими файлами
// Классификация ошибок Z.ai: сначала business code, потом HTTP status
type Kind = "auth" | "balance" | "quota" | "rate_limit" | "overloaded" | "bad_request" | "sensitive" | "server" | "network";
function classifyZaiError(status: number | null, code: string | null): Kind {
  const c = Number(code);
  if (c === 1113) return "balance";
  if (c >= 1308 && c <= 1321) return "quota";
  if (c === 1302) return "rate_limit";
  if (c === 1305) return "overloaded";
  if (c === 1301) return "sensitive";
  if ([1210, 1211, 1213, 1214, 1261].includes(c)) return "bad_request";
  if ([1200, 1230, 1234].includes(c)) return "server";
  if ([1000, 1001, 1003].includes(c)) return "auth";
  if (status === 401) return "auth";
  if (status === 429) return "rate_limit";
  if (status === 400) return "bad_request";
  if (status !== null && status >= 500) return "server";
  return status === null ? "network" : "bad_request";
}
const RETRY = new Set<Kind>(["rate_limit", "overloaded", "server", "network"]);
for (const [s, c] of [[429, "1302"], [429, "1113"], [429, "1310"], [400, "1211"], [503, null], [null, null]] as const) {
  const k = classifyZaiError(s, c);
  console.log(String(s).padEnd(5), String(c).padEnd(5), k.padEnd(12), "retry:", RETRY.has(k));
}
