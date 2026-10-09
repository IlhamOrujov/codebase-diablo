// Route handler Next.js 16: файл src/app/api/agent/draft/route.ts (здесь — тот же код для изучения)
import { z } from "zod";

export const maxDuration = 300;            // секунд на запрос (reasoning может думать долго)
const Body = z.object({ question: z.string().min(5).max(2000), systemId: z.string() });

export async function POST(req: Request): Promise<Response> {
  const parsed = Body.safeParse(await req.json().catch(() => null));     // тело запроса — untrusted input
  if (!parsed.success) return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  // здесь: const llm = createZaiLLM({ apiKey: env.ZAI_API_KEY }); const out = await draftInvestigation(llm, parsed.data)
  return Response.json({ ok: true, question: parsed.data.question });
}

// Проверка без Next: вызываем handler как обычную функцию
async function demo() {
  for (const body of [{ question: "Why is v2 worse?", systemId: "helper-v2" }, { question: "?" }]) {
    const res = await POST(new Request("http://x/api/agent/draft", { method: "POST", body: JSON.stringify(body) }));
    console.log(res.status, JSON.stringify(await res.json()));
  }
}
demo();
