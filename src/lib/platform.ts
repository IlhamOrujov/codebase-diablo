"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

function isMac() {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const p = nav.userAgentData?.platform ?? nav.platform ?? "";
  return /mac|iphone|ipad|ipod/i.test(p);
}

/**
 * The modifier glyph for shortcuts: "⌘" on Apple devices, "Ctrl" elsewhere.
 * The server and the first client render say "Ctrl"; the real value is
 * picked after hydration, so there is never a hydration mismatch.
 */
export function useModKey(): "⌘" | "Ctrl" {
  return useSyncExternalStore(noop, () => (isMac() ? "⌘" : "Ctrl"), () => "Ctrl");
}

/** True when the event carries the platform's command modifier. */
export function hasMod(e: KeyboardEvent | React.KeyboardEvent | WheelEvent | React.WheelEvent) {
  return e.metaKey || e.ctrlKey;
}

/** Ignore key handling while an IME is composing (Japanese, Chinese, Korean…). */
export function isComposing(e: KeyboardEvent | React.KeyboardEvent) {
  const native = "nativeEvent" in e ? e.nativeEvent : e;
  return native.isComposing || native.keyCode === 229;
}

/** Skip global shortcuts while the user types in a field. */
export function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT";
}
