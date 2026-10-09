import { describe, expect, it } from "vitest";
import { mcnemarExact } from "@/lib/stats";

// Тестируем код, а не модель: FakeLLM отдаёт заранее заданные ответы
class FakeLLM {
  calls = 0;
  constructor(private replies: string[]) {}
  async chat(): Promise<string> {
    const r = this.replies[this.calls++];
    if (r === undefined) throw new Error("FakeLLM: no reply");
    return r;
  }
}
async function askJson(llm: FakeLLM): Promise<{ n: number }> {
  for (let i = 0; i < 2; i++) {
    try { return JSON.parse(await llm.chat()); } catch { /* один repair */ }
  }
  throw new Error("invalid JSON twice");
}

describe("askJson", () => {
  it("parses valid JSON in one call", async () => {
    const llm = new FakeLLM(['{"n":3}']);
    expect(await askJson(llm)).toEqual({ n: 3 });
    expect(llm.calls).toBe(1);
  });
  it("repairs once, then succeeds", async () => {
    const llm = new FakeLLM(["not json", '{"n":4}']);
    await expect(askJson(llm)).resolves.toEqual({ n: 4 });
    expect(llm.calls).toBe(2);
  });
  it("gives up after two bad replies", async () => {
    await expect(askJson(new FakeLLM(["x", "y"]))).rejects.toThrow("invalid JSON twice");
  });
});

describe("project stats", () => {
  it("McNemar: no discordant pairs → p = 1", () => {
    expect(mcnemarExact(0, 0)).toBe(1);
  });
  it("McNemar: 16 vs 4 is below α = 0.05", () => {
    expect(mcnemarExact(16, 4)).toBeLessThan(0.05);
  });
});
