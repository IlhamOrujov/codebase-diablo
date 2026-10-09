"use client";

import { createContext, use, type ReactNode } from "react";
import type { Session } from "@/lib/auth/types";

export type { Session } from "@/lib/auth/types";

/**
 * The signed-in user, for client components. The (app) layout starts the
 * server-side session read without awaiting it and hands the promise down;
 * `useSession()` unwraps it, so only the components that show the user wait
 * for it (behind their own <Suspense>), never the shell.
 */
const SessionContext = createContext<Promise<Session | null> | null>(null);

export function SessionProvider({ session, children }: { session: Promise<Session | null>; children: ReactNode }) {
  return <SessionContext value={session}>{children}</SessionContext>;
}

/** The current session, or null when signed out. Suspends until it is known. */
export function useSession(): Session | null {
  const promise = use(SessionContext);
  if (!promise) throw new Error("useSession() must be used inside <SessionProvider>.");
  return use(promise);
}

/** Ends the session on the server, then leaves for sign-in with a full page load (clearing all client state). */
export async function signOut(): Promise<void> {
  try {
    await fetch("/api/auth/signout", { method: "POST", redirect: "manual", credentials: "same-origin" });
  } finally {
    // A full load on purpose: it drops every piece of client state and the router cache.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/");
  }
}
