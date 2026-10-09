/**
 * The session the UI sees. Safe for the browser: no tokens, no secrets.
 * `demo` sessions come from "Enter demo workspace"; `google` from Google OAuth.
 */
export type AuthProvider = "google" | "demo";

export interface SessionUser {
  /** Stable id: Google's `sub`, or "demo". */
  id: string;
  name: string;
  initials: string;
  email: string | null;
}

export interface Session {
  user: SessionUser;
  workspace: string;
  provider: AuthProvider;
  demo: boolean;
  /** Expiry, epoch seconds. */
  expiresAt: number;
}

export const DEMO_USER: Omit<SessionUser, "initials"> = { id: "demo", name: "Demo researcher", email: null };

/** "Ada Lovelace" → "AL", "plato" → "P", "" → "?". */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = [...parts[0]][0] ?? "";
  const last = parts.length > 1 ? ([...parts[parts.length - 1]][0] ?? "") : "";
  return (first + last).toUpperCase();
}
