"use client";

/**
 * The UI's only entry point to data. Components import hooks and the
 * provider from here and never import fixtures or the mock directly.
 */
import { useCallback, useSyncExternalStore } from "react";
import { mockProvider } from "./mock/provider";
import type { DataProvider, WorkspaceSnapshot } from "./provider";
import type { Investigation } from "./types";

export const provider: DataProvider = mockProvider;

export function useWorkspace(): WorkspaceSnapshot {
  return useSyncExternalStore(provider.subscribe, provider.getSnapshot, provider.getServerSnapshot);
}

/** Pinned first, then most recently updated. */
export function sortInvestigations(list: Investigation[]): Investigation[] {
  return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export function useInvestigation(id: string): { ready: boolean; inv: Investigation | undefined } {
  const ws = useWorkspace();
  return { ready: ws.ready, inv: ws.investigations.find((i) => i.id === id) };
}

export const familyOf = (systemId: string) => provider.getSystem(systemId)?.family ?? null;
export const systemName = (systemId: string) => provider.getSystem(systemId)?.name ?? "Unknown system";

/* ── Clock ──────────────────────────────────────────────────────
   A shared clock read through useSyncExternalStore: the server (and the
   prerender) sees 0, so time never leaks into static HTML; in the browser each
   subscriber ticks at its own interval, only while the tab is visible. */
let latest = 0;
const readClock = () => {
  if (latest === 0) latest = Date.now();
  return latest;
};

/**
 * The current time, refreshed every `ms` while `active` and while the tab is
 * visible. Use it only on screens that show running items or relative times.
 */
export function useNow(ms = 1000, active = true): number {
  const subscribe = useCallback(
    (cb: () => void) => {
      if (!active) return () => {};
      let t: ReturnType<typeof setInterval> | null = null;
      const tick = () => {
        latest = Date.now();
        cb();
      };
      const start = () => {
        if (t === null && document.visibilityState === "visible") {
          tick();
          t = setInterval(tick, ms);
        }
      };
      const stop = () => {
        if (t !== null) clearInterval(t);
        t = null;
      };
      const onVis = () => (document.visibilityState === "visible" ? start() : stop());
      start();
      document.addEventListener("visibilitychange", onVis);
      return () => {
        stop();
        document.removeEventListener("visibilitychange", onVis);
      };
    },
    [ms, active],
  );
  return useSyncExternalStore(subscribe, readClock, () => 0);
}

export type { Investigation } from "./types";
