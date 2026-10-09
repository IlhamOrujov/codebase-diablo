import { z } from "zod";
// Одна schema = runtime-проверка + TypeScript type
const Hypothesis = z.object({
  id: z.string().regex(/^H\d+$/),
  text: z.string().min(10).max(300),
  prediction: z.enum(["increase", "decrease", "no-difference"]),
  competing: z.boolean(),
});
type Hypothesis = z.infer<typeof Hypothesis>;

const good: unknown = { id: "H1", text: "Shorter system prompt hurts arithmetic.", prediction: "decrease", competing: false };
const bad: unknown = { id: "h1", text: "short", prediction: "worse" };
const g = Hypothesis.safeParse(good);
console.log("good:", g.success, g.success && (g.data satisfies Hypothesis).id);
const b = Hypothesis.safeParse(bad);
if (!b.success) console.log(z.prettifyError(b.error));
