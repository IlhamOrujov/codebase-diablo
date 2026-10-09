import { createHash, createHmac } from "node:crypto";

// canonicalJson: одинаковый объект → одинаковая строка, порядок ключей не важен
function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson((v as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(v);
}
const sha256 = (s: string) => "sha256:" + createHash("sha256").update(s).digest("hex");

const a = { model: "glm-4.7-flash", temperature: 0.3 };
const b = { temperature: 0.3, model: "glm-4.7-flash" };
console.log(sha256(canonicalJson(a)) === sha256(canonicalJson(b)), sha256(canonicalJson(a)).slice(0, 23));

// HMAC: подпись, которую нельзя подделать без секрета
const sign = (data: string) => createHmac("sha256", "dev-secret").update(data).digest("hex").slice(0, 16);
console.log("counts 41/80:", sign('{"k":41,"n":80}'));
console.log("counts 51/80:", sign('{"k":51,"n":80}'));
