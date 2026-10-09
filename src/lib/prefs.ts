"use client";

import { useSyncExternalStore } from "react";

/**
 * Per-browser preferences: theme, motion and the sidebar. Each is mirrored on
 * an attribute of <html>, which the boot script (src/lib/boot.ts) sets before
 * first paint, so the server HTML never has to guess.
 */

export type ThemePref = "light" | "dark" | "system";
export type MotionPref = "system" | "reduce";

const KEY = {
  theme: "diablo.theme",
  motion: "diablo.motion",
  sidebar: "diablo.sidebar",
} as const;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage unavailable (private mode): the choice lasts for this page only.
  }
}

const root = () => document.documentElement;

/* ── Theme ─────────────────────────────────────────────────────── */

export function getThemePref(): ThemePref {
  const v = read(KEY.theme);
  return v === "light" || v === "dark" ? v : "system";
}

export function applyTheme() {
  const pref = getThemePref();
  const dark = pref === "dark" || (pref === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  root().setAttribute("data-theme", dark ? "dark" : "light");
}

/** Switching is instant: no reveal, no transition. */
export function setThemePref(pref: ThemePref) {
  write(KEY.theme, pref === "system" ? null : pref);
  applyTheme();
  emit();
}

export function useThemePref(): ThemePref {
  return useSyncExternalStore(subscribe, getThemePref, () => "system");
}

export function useResolvedTheme(): "light" | "dark" {
  return useSyncExternalStore(
    subscribe,
    () => (root().getAttribute("data-theme") === "dark" ? "dark" : "light"),
    () => "light",
  );
}

/* ── Motion ────────────────────────────────────────────────────── */

export function getMotionPref(): MotionPref {
  return read(KEY.motion) === "reduce" ? "reduce" : "system";
}

export function setMotionPref(pref: MotionPref) {
  write(KEY.motion, pref === "reduce" ? "reduce" : null);
  if (pref === "reduce") root().setAttribute("data-motion", "reduce");
  else root().removeAttribute("data-motion");
  emit();
}

export function useMotionPref(): MotionPref {
  return useSyncExternalStore(subscribe, getMotionPref, () => "system");
}

/* ── Sidebar ───────────────────────────────────────────────────── */

export function isSidebarCollapsed() {
  return root().getAttribute("data-sidebar") === "collapsed";
}

export function setSidebarCollapsed(collapsed: boolean) {
  if (collapsed) root().setAttribute("data-sidebar", "collapsed");
  else root().removeAttribute("data-sidebar");
  write(KEY.sidebar, collapsed ? "collapsed" : null);
  emit();
}

export function useSidebarCollapsed(): boolean {
  return useSyncExternalStore(subscribe, isSidebarCollapsed, () => false);
}

/** Keep "System" in sync with the OS, and preferences in sync across tabs. */
export function watchPreferences() {
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const onScheme = () => {
    if (getThemePref() === "system") {
      applyTheme();
      emit();
    }
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY.theme) {
      applyTheme();
      emit();
    }
  };
  mq.addEventListener("change", onScheme);
  window.addEventListener("storage", onStorage);
  return () => {
    mq.removeEventListener("change", onScheme);
    window.removeEventListener("storage", onStorage);
  };
}
