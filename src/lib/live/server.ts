import "server-only";
import { liveConfig } from "./env";
import { LiveGuard } from "./guard";

type G = typeof globalThis & { __diabloLiveGuard?: LiveGuard };

/** One guard per server process (survives hot reloads in development). */
export function liveGuard(): LiveGuard {
  const g = globalThis as G;
  g.__diabloLiveGuard ??= new LiveGuard(() => liveConfig().limits);
  return g.__diabloLiveGuard;
}

/** A per-session key that is not the cookie itself: SHA-256 of the session token, shortened. */
export async function sessionKey(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest).slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
}
