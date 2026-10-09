import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { authSecret } from "./env";
import { SESSION_COOKIE, verifySession } from "./session";
import type { Session } from "./types";

/**
 * Data access layer: the only way server code reads the session. The proxy
 * already turned away visitors without a valid cookie; this verifies again
 * where the data is used. Deduplicated per request.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySession(token, authSecret());
});
