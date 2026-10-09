import type { NextRequest } from "next/server";
import { authSecret, googleConfig, secureCookies } from "@/lib/auth/env";
import { authorizationUrl, newFlow, OAUTH_COOKIE, OAUTH_COOKIE_PATH, OAUTH_TTL_SECONDS, sealFlow } from "@/lib/auth/google";
import { authFailure, originOf, redirectTo, redirectWithError, requestOrigin } from "@/lib/auth/http";
import { safeNext } from "@/lib/auth/next-path";

/**
 * Starts Google sign-in. A plain GET navigation (a link, not a form): Chrome
 * applies CSP form-action to a form's redirect chain, which would block the
 * hop to accounts.google.com.
 */
export async function GET(request: NextRequest) {
  try {
    return await handle(request);
  } catch (err) {
    return authFailure(request, err);
  }
}

async function handle(request: NextRequest) {
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const config = googleConfig();
  if (!config) return redirectWithError(request, "google_unavailable", next);

  // The flow cookie must be set on the host Google will send the visitor back
  // to, so start over on the canonical origin when APP_ORIGIN differs.
  const origin = originOf(request);
  if (origin !== requestOrigin(request)) {
    return redirectTo(request, `${origin}/api/auth/google?${new URLSearchParams({ next })}`, 302);
  }

  // State, PKCE verifier and OIDC nonce, all bound to this browser's cookie.
  const flow = newFlow(next);
  const url = await authorizationUrl(config, origin, flow);
  const res = redirectTo(request, url.toString(), 302);
  res.cookies.set(OAUTH_COOKIE, await sealFlow(flow, authSecret()), {
    httpOnly: true,
    secure: secureCookies(),
    // Lax: the cookie must come back on Google's top-level redirect to us.
    sameSite: "lax",
    path: OAUTH_COOKIE_PATH,
    maxAge: OAUTH_TTL_SECONDS,
  });
  return res;
}
