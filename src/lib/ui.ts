"use client";

import { useSyncExternalStore } from "react";

/** Transient UI state shared across the shell: toasts and the open overlays. */

export type Toast = { id: number; title: string; body?: string };

type UIState = {
  toasts: Toast[];
  palette: boolean;
  shortcuts: boolean;
  drawer: boolean;
};

let state: UIState = { toasts: [], palette: false, shortcuts: false, drawer: false };
const SERVER: UIState = state;
const listeners = new Set<() => void>();

function set(patch: Partial<UIState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useUI<T>(select: (s: UIState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => select(state),
    () => select(SERVER),
  );
}

export const ui = {
  setPalette: (palette: boolean) => set({ palette }),
  setShortcuts: (shortcuts: boolean) => set({ shortcuts }),
  setDrawer: (drawer: boolean) => set({ drawer }),
};

let seq = 0;
/** Toasts stay until their timer runs out; the timer pauses while hovered or focused (see Toasts). */
export function toast(t: Omit<Toast, "id">) {
  const id = ++seq;
  set({ toasts: [...state.toasts.slice(-2), { ...t, id }] });
  return id;
}

export function dismissToast(id: number) {
  set({ toasts: state.toasts.filter((t) => t.id !== id) });
}
