/**
 * Scripted stand-ins for tests: a FakeLLM that replays responses in order (or
 * computes them), and a fake target that answers arithmetic with accuracy set
 * per configuration. No network, fully deterministic.
 */
import { hashString } from "@/lib/data/derive";
import { LLMError, type LLM, type LLMRequest, type LLMResponse } from "./types";

export type FakeReply = string | { text: string; inputTokens?: number; outputTokens?: number; finishReason?: string } | LLMError;
export type FakeScript = FakeReply[] | ((request: LLMRequest, index: number) => FakeReply | Promise<FakeReply>);

export class FakeLLM implements LLM {
  readonly provider = "fake" as const;
  readonly calls: LLMRequest[] = [];

  constructor(
    readonly model: string,
    private readonly script: FakeScript,
  ) {}

  async complete(request: LLMRequest): Promise<LLMResponse> {
    if (request.signal?.aborted) throw new LLMError("aborted", "The call was cancelled.", { provider: "fake" });
    const index = this.calls.length;
    this.calls.push(request);
    let reply: FakeReply | undefined;
    if (typeof this.script === "function") reply = await this.script(request, index);
    else reply = this.script[index];
    if (reply === undefined) throw new Error(`FakeLLM ${this.model}: no scripted reply for call ${index + 1}`);
    if (reply instanceof LLMError) throw reply;
    const r = typeof reply === "string" ? { text: reply } : reply;
    return {
      text: r.text,
      usage: { inputTokens: r.inputTokens ?? 100, outputTokens: r.outputTokens ?? 20 },
      model: this.model,
      finishReason: r.finishReason ?? "STOP",
    };
  }
}

/**
 * A fake "Helper" that knows the right answers and is right with a
 * probability that depends on its configuration. Whether a given item is
 * answered correctly is a hash of (item, configuration), so runs repeat
 * exactly. `answers` maps the user prompt to the exact answer.
 */
export function fakeTarget(
  answers: Map<string, number>,
  accuracy: (request: LLMRequest) => number,
  opts: { delayMs?: number; failWhen?: (request: LLMRequest, index: number) => LLMError | null } = {},
): FakeLLM {
  return new FakeLLM("fake-target", async (request, index) => {
    const fail = opts.failWhen?.(request, index);
    if (fail) return fail;
    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
    const prompt = request.messages[request.messages.length - 1]?.content ?? "";
    const answer = answers.get(prompt);
    if (answer === undefined) return "I am not sure.";
    const u = hashString(`${prompt}|${request.system}|${request.temperature}`) / 2 ** 32;
    const right = u < accuracy(request);
    return { text: `Working it out. Answer: ${right ? answer : answer + 7}`, inputTokens: 60, outputTokens: 30 };
  });
}
