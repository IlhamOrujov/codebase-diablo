import { z } from "zod";
// z.toJSONSchema: та же schema уходит в prompt (у GLM нет json_schema mode)
const Draft = z.object({
  hypotheses: z.array(z.object({ id: z.string(), competing: z.boolean() })).min(2),
  datasetId: z.enum(["arith-v1", "syco-v1"]),        // closed vocabulary
});
console.log(JSON.stringify(z.toJSONSchema(Draft)));
