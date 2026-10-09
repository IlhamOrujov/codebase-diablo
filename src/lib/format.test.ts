import { describe, expect, it } from "vitest";
import { recencyGroup, relativeTime } from "./format";
import { CREATED_ID, investigationId, slugify, titleFromQuestion } from "./slug";

const NOW = Date.parse("2026-10-07T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("relativeTime", () => {
  it("formats recent and older times", () => {
    expect(relativeTime(ago(10_000), NOW)).toBe("just now");
    expect(relativeTime(ago(8 * 60_000), NOW)).toBe("8 minutes ago");
    expect(relativeTime(ago(3 * 3600_000), NOW)).toBe("3 hours ago");
    expect(relativeTime(ago(24 * 3600_000), NOW)).toBe("yesterday");
    expect(relativeTime(ago(2 * 86400_000), NOW)).toBe("2 days ago");
  });
  it("advances with the clock", () => {
    const t = ago(8 * 60_000);
    expect(relativeTime(t, NOW + 60 * 60_000)).toBe("1 hour ago");
  });
});

describe("recencyGroup", () => {
  it("groups by calendar day", () => {
    expect(recencyGroup(ago(60_000), NOW)).toBe("Today");
    expect(recencyGroup(ago(3 * 86400_000), NOW)).toBe("Previous 7 days");
    expect(recencyGroup(ago(30 * 86400_000), NOW)).toBe("Older");
  });
});

describe("slugify", () => {
  it("keeps ASCII words", () => {
    expect(slugify("Does Model X refuse more often?")).toBe("does-model-x-refuse-more-often");
  });
  it("transliterates Cyrillic", () => {
    expect(slugify("Становится ли модель льстивой?")).toBe("stanovitsya-li-model-lstivoy");
  });
  it("transliterates Azerbaijani", () => {
    expect(slugify("Model şübhəli iddialarla razılaşırmı?")).toBe("model-subheli-iddialarla-razilasirmi");
  });
  it("falls back when nothing is left", () => {
    expect(slugify("模型会拒绝吗？")).toBe("investigation");
    expect(slugify("???")).toBe("investigation");
  });
  it("makes ids the server accepts", () => {
    for (const q of ["Становится ли модель льстивой?", "Model şübhəli iddialarla razılaşırmı?", "模型会拒绝吗？"]) {
      expect(investigationId(titleFromQuestion(q))).toMatch(CREATED_ID);
    }
  });
});

describe("titleFromQuestion", () => {
  it("does not append a question mark or keep trailing punctuation", () => {
    expect(titleFromQuestion("check refusals on medical prompts.")).toBe("Check refusals on medical prompts");
    expect(titleFromQuestion("Is it calibrated?!")).toBe("Is it calibrated");
  });
  it("truncates at a word boundary", () => {
    const t = titleFromQuestion("Does the new model become more sycophantic when the user is confident and insistent?");
    expect(t.length).toBeLessThanOrEqual(60);
    expect(t.endsWith("…")).toBe(true);
  });
});
