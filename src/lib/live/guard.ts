/**
 * Abuse controls for live runs. In-memory and per server instance: best
 * effort, not a distributed limiter. On a serverless platform each instance
 * keeps its own counts and a cold start resets them, so the provider's own
 * quota stays the final backstop. The rules:
 *
 * - one run at a time per session, and a cooldown after each run;
 * - at most `maxConcurrentRuns` runs at once on the instance;
 * - a daily call cap (UTC day): a run reserves its worst-case call count up
 *   front; when it ends, the reservation is replaced by the calls it made.
 */
import type { AbuseLimits } from "./types";

export type Refusal = { ok: false; code: "busy" | "cooldown" | "server-busy" | "daily-cap"; message: string; retryAfterSeconds: number };
export interface Lease {
  ok: true;
  /** Ends the run: frees the slots and counts the calls actually made against today's cap. */
  release(callsUsed: number, now?: number): void;
}

const utcDay = (t: number) => new Date(t).toISOString().slice(0, 10);
const secondsUntilNextUtcDay = (t: number) => {
  const d = new Date(t);
  return Math.ceil((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - t) / 1000);
};

export class LiveGuard {
  private active = new Set<string>();
  private lastEnded = new Map<string, number>();
  private day = "";
  private used = 0;

  constructor(private readonly limits: () => AbuseLimits) {}

  /** Calls counted against today's cap so far (reservations included). */
  usedToday(now = Date.now()): number {
    this.roll(now);
    return this.used;
  }

  private roll(now: number) {
    const today = utcDay(now);
    if (today !== this.day) {
      this.day = today;
      this.used = 0;
    }
  }

  acquire(sessionKey: string, reserveCalls: number, now = Date.now()): Lease | Refusal {
    const limits = this.limits();
    this.roll(now);
    if (this.active.has(sessionKey)) {
      return { ok: false, code: "busy", message: "A live run is already in progress for this session.", retryAfterSeconds: 30 };
    }
    const last = this.lastEnded.get(sessionKey);
    if (last !== undefined && now - last < limits.cooldownMs) {
      const wait = Math.ceil((limits.cooldownMs - (now - last)) / 1000);
      return { ok: false, code: "cooldown", message: `Please wait ${wait} s before starting another live run.`, retryAfterSeconds: wait };
    }
    if (this.active.size >= limits.maxConcurrentRuns) {
      return { ok: false, code: "server-busy", message: "Other live runs are in progress. Try again in a minute.", retryAfterSeconds: 60 };
    }
    if (this.used + reserveCalls > limits.dailyCallCap) {
      return {
        ok: false,
        code: "daily-cap",
        message: "Today's live-run budget on this server is used up. It resets at midnight UTC.",
        retryAfterSeconds: secondsUntilNextUtcDay(now),
      };
    }
    this.active.add(sessionKey);
    this.used += reserveCalls;
    const day = this.day;
    let released = false;
    return {
      ok: true,
      release: (callsUsed: number, at = Date.now()) => {
        if (released) return;
        released = true;
        this.active.delete(sessionKey);
        const t = at;
        this.lastEnded.set(sessionKey, t);
        // Replace the reservation with the calls actually made (fewer, or a few more after rate-limit
        // retries), if the day has not rolled over meanwhile.
        if (this.day === day) this.used = Math.max(0, this.used - reserveCalls + Math.max(0, callsUsed));
        // Keep the cooldown map small.
        if (this.lastEnded.size > 1000) {
          for (const [k, v] of this.lastEnded) if (t - v > limits.cooldownMs) this.lastEnded.delete(k);
        }
      },
    };
  }
}
