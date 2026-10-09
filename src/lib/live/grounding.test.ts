import { describe, expect, it } from "vitest";
import { checkGrounded } from "./grounding";
import type { Fact } from "./types";

const facts: Fact[] = [
  { id: "F1", label: "Helper v1 temperature", value: "0.2" },
  { id: "F2", label: "E1 control accuracy", value: "95.0%" },
  { id: "F3", label: "E1 treatment accuracy", value: "42.5%" },
  { id: "F4", label: "E1 difference", value: "−52.5 pp" },
  { id: "F5", label: "E1 exact McNemar test", value: "p < 0.001" },
  { id: "F6", label: "H1 verdict", value: "supported" },
];
const refs = ["E1", "E2", "H1", "H2"];
const check = (text: string) => checkGrounded(text, facts, refs);

describe("grounding checker", () => {
  it("accepts placeholders and substitutes the values computed by code", () => {
    const r = check("In {{E1}}, accuracy fell from {{F2}} to {{F3}} ({{F4}}, {{F5}}), so {{H1}} is {{F6}}. The temperature change from {{ F1 }} matters less.");
    expect(r).toEqual({
      ok: true,
      text: "In E1, accuracy fell from 95.0% to 42.5% (−52.5 pp, p < 0.001), so H1 is supported. The temperature change from 0.2 matters less.",
      cited: ["F2", "F3", "F4", "F5", "F6", "F1"],
    });
  });

  it("rejects any digit outside a placeholder", () => {
    const r = check("Accuracy fell by 52 points in {{E1}} ({{F4}}).");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems.join()).toMatch(/number was written outside a placeholder/);
    // Digits in other scripts too.
    expect(check("Accuracy fell by ٥٢ in {{E1}} ({{F4}}).").ok).toBe(false);
  });

  it("rejects bare experiment ids: they must be placeholders too", () => {
    expect(check("E1 shows {{F4}}.").ok).toBe(false);
  });

  it("rejects placeholders that are not in the table", () => {
    const r = check("{{E1}} shows {{F4}} and {{F99}}; {{E7}} and {{X1}} do not exist.");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.problems).toContain("{{F99}} is not in the fact table.");
      expect(r.problems.join()).toMatch(/\{\{E7\}\} is not an experiment/);
      expect(r.problems.join()).toMatch(/\{\{X1\}\} is not a known placeholder/);
    }
  });

  it("rejects percent signs, quantity words and stray braces", () => {
    expect(check("{{E1}} lost {{F4}}%.").ok).toBe(false);
    expect(check("{{E1}} roughly halved accuracy ({{F4}}).").ok).toBe(false);
    expect(check("{{E1}} lost twenty percent ({{F4}}).").ok).toBe(false);
    expect(check("{{E1}} lost {F4}.").ok).toBe(false);
  });

  it("allows small counting words, and requires at least one cited fact", () => {
    expect(check("Both changes shipped together; {{E1}} isolates one of the two ({{F4}}).").ok).toBe(true);
    const r = check("The prompt is to blame.");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems.join()).toMatch(/cites no fact/);
  });

  it("rejects empty and overlong text", () => {
    expect(check("   ").ok).toBe(false);
    expect(check(`{{F4}} ${"word ".repeat(400)}`).ok).toBe(false);
  });
});
