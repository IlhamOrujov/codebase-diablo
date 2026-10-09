import { describe, expect, it } from "vitest";
import { parseSaved, STATE_VERSION } from "./schema";
import { seedInvestigations } from "./mock/fixtures";

const valid = JSON.stringify({ version: STATE_VERSION, seededAt: new Date().toISOString(), investigations: seedInvestigations(Date.now()) });

describe("parseSaved", () => {
  it("accepts a valid saved workspace", () => {
    const r = parseSaved(valid);
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") expect(r.data.investigations).toHaveLength(4);
  });
  it("treats nothing saved as empty", () => {
    expect(parseSaved(null).kind).toBe("empty");
  });
  it("recovers from corrupt JSON", () => {
    expect(parseSaved("{not json")).toEqual({ kind: "reset", reason: "corrupt" });
  });
  it("resets an older version (migration path)", () => {
    expect(parseSaved(JSON.stringify([{ id: "sycophancy-model-x", updatedMin: 8 }]))).toEqual({ kind: "reset", reason: "old-version" });
    expect(parseSaved(JSON.stringify({ version: 1, investigations: [] }))).toEqual({ kind: "reset", reason: "old-version" });
  });
  it("rejects a tampered shape", () => {
    const data = JSON.parse(valid);
    data.investigations[0].experiments[0].runs[0].counts.control.k = 9999; // k > n
    expect(parseSaved(JSON.stringify(data))).toEqual({ kind: "reset", reason: "invalid" });
    data.investigations[0].id = "<script>";
    expect(parseSaved(JSON.stringify(data)).kind).toBe("reset");
  });
});
