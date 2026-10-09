import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/admin/settings", () => ({ getSystemSettings: async () => ({ reasoner: "claude", updatedAt: null }) }));
const { configForReasoner } = await import("./team");

const env = { ANTHROPIC_API_KEY: "a-key", GEMINI_API_KEY: "g-key" };

describe("the system-wide reasoner", () => {
  it("is Claude by default", () => {
    expect(configForReasoner("claude", env).provider).toBe("anthropic");
  });
  it("is Gemini when an admin switched it and the key is set", () => {
    expect(configForReasoner("gemini", env).provider).toBe("gemini");
  });
  it("stays on Claude when the Gemini key is missing", () => {
    expect(configForReasoner("gemini", { ...env, GEMINI_API_KEY: "" }).provider).toBe("anthropic");
  });
});
