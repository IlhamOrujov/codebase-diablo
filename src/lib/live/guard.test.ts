import { describe, expect, it } from "vitest";
import { LiveGuard } from "./guard";

const limits = { dailyCallCap: 400, cooldownMs: 60_000, maxConcurrentRuns: 2 };
const T = Date.parse("2026-10-09T10:00:00Z");

describe("live guard (in-memory abuse controls)", () => {
  it("one run per session at a time, then a cooldown", () => {
    const g = new LiveGuard(() => limits);
    const a = g.acquire("s1", 165, T);
    expect(a.ok).toBe(true);
    expect(g.acquire("s1", 165, T + 1000)).toMatchObject({ ok: false, code: "busy" });
    if (a.ok) a.release(100, T + 5000);
    expect(g.acquire("s1", 165, T + 10_000)).toMatchObject({ ok: false, code: "cooldown", retryAfterSeconds: 55 });
    expect(g.acquire("s1", 165, T + 66_000).ok).toBe(true);
  });

  it("limits concurrent runs across sessions", () => {
    const g = new LiveGuard(() => ({ ...limits, dailyCallCap: 10_000 }));
    expect(g.acquire("a", 10, T).ok).toBe(true);
    expect(g.acquire("b", 10, T).ok).toBe(true);
    expect(g.acquire("c", 10, T)).toMatchObject({ ok: false, code: "server-busy" });
  });

  it("reserves the worst case against the daily cap and gives back the unused part", () => {
    const g = new LiveGuard(() => limits);
    const a = g.acquire("a", 165, T);
    const b = g.acquire("b", 165, T);
    expect(g.usedToday(T)).toBe(330);
    if (a.ok) a.release(40, T + 1000);
    expect(g.usedToday(T)).toBe(205);
    expect(g.acquire("c", 165, T + 2000).ok).toBe(true); // 370 ≤ 400
    if (b.ok) b.release(165, T + 3000);
    expect(g.acquire("d", 165, T + 4000)).toMatchObject({ ok: false, code: "daily-cap" });
  });

  it("the cap resets on the next UTC day", () => {
    const g = new LiveGuard(() => ({ ...limits, dailyCallCap: 100 }));
    const a = g.acquire("a", 100, T);
    if (a.ok) a.release(100, T);
    const refused = g.acquire("b", 10, T + 1000);
    expect(refused).toMatchObject({ ok: false, code: "daily-cap" });
    if (!refused.ok) expect(refused.retryAfterSeconds).toBe(14 * 3600 - 1);
    expect(g.acquire("b", 10, Date.parse("2026-10-10T00:00:01Z")).ok).toBe(true);
  });

  it("counts calls beyond the reservation (rate-limit retries) against the cap", () => {
    const g = new LiveGuard(() => limits);
    const a = g.acquire("a", 100, T);
    if (a.ok) a.release(130, T);
    expect(g.usedToday(T)).toBe(130);
  });

  it("releasing twice changes nothing", () => {
    const g = new LiveGuard(() => limits);
    const a = g.acquire("a", 100, T);
    if (a.ok) {
      a.release(10, T);
      a.release(0, T);
    }
    expect(g.usedToday(T)).toBe(10);
  });
});
