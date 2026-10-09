import { describe, expect, it } from "vitest";
import { safeNext } from "./next-path";

describe("safeNext (open-redirect guard)", () => {
  it("keeps same-site relative paths with query and hash", () => {
    expect(safeNext("/investigations/sycophancy-model-x?tab=report#top")).toBe("/investigations/sycophancy-model-x?tab=report#top");
    expect(safeNext("/settings")).toBe("/settings");
  });

  it("falls back for missing or empty values", () => {
    expect(safeNext(null)).toBe("/home");
    expect(safeNext(undefined)).toBe("/home");
    expect(safeNext("")).toBe("/home");
    expect(safeNext("", "")).toBe("");
  });

  it("refuses absolute, protocol-relative and scheme URLs", () => {
    for (const evil of [
      "https://evil.example",
      "//evil.example",
      "///evil.example",
      "/\\evil.example",
      "\\\\evil.example",
      "javascript:alert(1)",
      "evil.example/home",
      "/\t/evil.example",
      "/\n/evil.example",
      "%2F%2Fevil.example",
    ]) {
      expect(safeNext(evil), evil).toBe("/home");
    }
  });

  it("never points back at sign-in or the auth endpoints", () => {
    expect(safeNext("/")).toBe("/home");
    expect(safeNext("/?error=x")).toBe("/home");
    expect(safeNext("/api/auth/signout")).toBe("/home");
  });

  it("normalises dot segments without leaving the origin", () => {
    expect(safeNext("/a/../settings")).toBe("/settings");
    expect(safeNext("/../../etc")).toBe("/etc");
  });

  it("refuses dot segments that collapse into a protocol-relative URL", () => {
    // Each of these used to come back as "//evil.example…", which the
    // redirect resolved to https://evil.example.
    for (const evil of ["/.//evil.example", "/a/..//evil.example", "/%2e//evil.example", "/%2E%2E//evil.example", "/home/..//evil.example/x", "/././/evil.example"]) {
      expect(safeNext(evil), evil).toBe("/home");
    }
  });

  it("never leaves the origin, and is idempotent, across generated paths", () => {
    const parts = ["", ".", "..", "%2e", "%2e%2e", "evil.example", "a", "%2f", "@evil.example"];
    const origin = "https://diablo.example";
    let checked = 0;
    for (const a of parts) {
      for (const b of parts) {
        for (const c of parts) {
          for (const d of parts) {
            const input = `/${a}/${b}/${c}/${d}`;
            const out = safeNext(input);
            expect(new URL(out, origin).origin, input).toBe(origin);
            expect(out.startsWith("/") && !out.startsWith("//"), input).toBe(true);
            expect(safeNext(out), input).toBe(out);
            checked++;
          }
        }
      }
    }
    expect(checked).toBe(parts.length ** 4);
  });
});
