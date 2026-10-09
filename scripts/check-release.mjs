// Fails while any legal or contact detail in src/lib/brand.ts is still a placeholder.
// Run before a public release: `npm run check:release`. Plain Node, works on Windows.
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/lib/brand.ts", import.meta.url), "utf8");
const open = [...src.matchAll(/^\s*(\w+):\s*PLACEHOLDER,/gm)].map((m) => m[1]);
if (open.length) {
  console.error(`Release check failed: ${open.length} placeholder(s) in src/lib/brand.ts: ${open.join(", ")}.`);
  console.error("Fill them in (entity, address, contact, governing law, IP terms) before a public release.");
  process.exit(1);
}
console.log("Release check passed: no placeholders left in src/lib/brand.ts.");
