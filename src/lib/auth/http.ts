import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { appOrigin, authSecret, secureCookies } from "./env";
import { OAUTH_COOKIE, OAUTH_COOKIE_PATH, type AuthErrorCode } from "./google";
import { SESSION_COOKIE, sessionCookieOptions, signSession, type SessionInput } from "./session";

/** Route-handler helpers: cookies, redirects and the same-origin check. */

/**
 * The origin the visitor actually used, from the (forwarded) Host header, as
 * Next.js does for Server Actions. `nextUrl.origin` can be the server's own
 * hostname (e.g. localhost) rather than the one in the address bar.
 */
export function requestOrigin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || request.nextUrl.protocol.replace(/:$/, "");
  if (host && /^[a-z0-9.\-\[\]:]+$/i.test(host) && (proto === "http" || proto === "https")) return `${proto}://${host}`;
  return request.nextUrl.origin;
}

/** The canonical public origin (APP_ORIGIN), used for the OAuth redirect URI. */
export function originOf(request: NextRequest): string {
  return appOrigin(requestOrigin(request));
}

/**
 * Redirects stay on the host the visitor is on, where their cookies live.
 * 303 so a POST becomes a GET on the other side.
 */
export function redirectTo(request: NextRequest, path: string, status: 302 | 303 = 303): NextResponse {
  const res = NextResponse.redirect(new URL(path, requestOrigin(request)), status);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export function redirectWithError(request: NextRequest, code: AuthErrorCode, next?: string): NextResponse {
  const params = new URLSearchParams({ error: code });
  if (next && next !== "/home") params.set("next", next);
  return redirectTo(request, `/?${params}`, 302);
}

export async function setSession(res: NextResponse, input: SessionInput): Promise<NextResponse> {
  res.cookies.set(SESSION_COOKIE, await signSession(input, authSecret()), sessionCookieOptions(secureCookies()));
  return res;
}

export function clearSession(res: NextResponse): NextResponse {
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(secureCookies()), maxAge: 0 });
  return res;
}

/**
 * CSRF guard for state-changing POSTs: the browser's Origin must be ours.
 * Without Origin, fall back to Fetch Metadata; with neither, refuse.
 */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (origin) {
    return origin === requestOrigin(request) || origin === originOf(request);
  }
  return request.headers.get("sec-fetch-site") === "same-origin";
}

/** Forgets the single-use OAuth flow cookie. */
export function clearFlow(res: NextResponse): NextResponse {
  res.cookies.set(OAUTH_COOKIE, "", { httpOnly: true, secure: secureCookies(), sameSite: "lax", path: OAUTH_COOKIE_PATH, maxAge: 0 });
  return res;
}

/**
 * Last resort for the sign-in routes: whatever throws (a missing secret, a
 * broken cookie, an unexpected response), the visitor goes back to the
 * sign-in page with a message, never to a 500 page.
 */
export function authFailure(request: NextRequest, err: unknown): NextResponse {
  console.error("[auth] sign-in failed unexpectedly:", err instanceof Error ? err.message : "unknown error");
  try {
    return clearFlow(redirectWithError(request, "server_error"));
  } catch {
    const res = NextResponse.redirect(new URL("/?error=server_error", request.url), 302);
    res.headers.set("Cache-Control", "no-store");
    return res;
  }
}
