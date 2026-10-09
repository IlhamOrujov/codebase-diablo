export {}; // файл — module: свои имена не конфликтуют с другими файлами
// Разбор ответа chat/completions (форма из docs.z.ai). Числа — пример.
const raw = `{"id":"2026100900001","request_id":"req-001","model":"glm-5.3",
 "choices":[{"index":0,"finish_reason":"stop",
   "message":{"role":"assistant","content":"OK","reasoning_content":"The user wants the word OK."}}],
 "usage":{"prompt_tokens":14,"completion_tokens":27,"total_tokens":41,"prompt_tokens_details":{"cached_tokens":0}}}`;

type ZaiResponse = {
  model: string;
  choices: { finish_reason: string; message: { content: string | null; reasoning_content?: string } }[];
  usage: { prompt_tokens: number; completion_tokens: number; prompt_tokens_details?: { cached_tokens?: number } };
};
const r = JSON.parse(raw) as ZaiResponse;
const c = r.choices[0];
console.log({
  content: c.message.content,
  reasoningChars: c.message.reasoning_content?.length ?? 0,
  finish: c.finish_reason,                      // stop | length | tool_calls | sensitive | ...
  prompt: r.usage.prompt_tokens,
  completion: r.usage.completion_tokens,        // включает reasoning
  cached: r.usage.prompt_tokens_details?.cached_tokens ?? 0,
});
