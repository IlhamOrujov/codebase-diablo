import type { NextRequest } from "next/server";
import { authSecret, googleConfig } from "@/lib/auth/env";
import { AuthFlowError, checkCallback, exchangeCode, OAUTH_COOKIE, openFlow } from "@/lib/auth/google";
import { authFailure, clearFlow, originOf, redirectTo, redirectWithError, setSession } from "@/lib/auth/http";
import { safeNext } from "@/lib/auth/next-path";

/** Google sends the visitor back here with ?code&state, or with ?error. */
export async function GET(request: NextRequest) {
  try {
    return await handle(request);
  } catch (err) {
    return authFailure(request, err);
  }
}

async function handle(request: NextRequest) {
  const flow = await openFlow(request.cookies.get(OAUTH_COOKIE)?.value, authSecret());
  const config = googleConfig();
  // No flow can have started without Google configured.
  if (!config) return clearFlow(redirectWithError(request, "google_unavailable"));

  try {
    const checked = checkCallback(request.nextUrl.searchParams, flow);
    const identity = await exchangeCode(config, originOf(request), {
      code: checked.code,
      verifier: checked.flow.verifier,
      nonce: checked.flow.nonce,
    });
    console.info("[auth] Google sign-in succeeded");
    // `next` was sanitised before it was sealed; sanitise again where it is used.
    return clearFlow(await setSession(redirectTo(request, safeNext(checked.flow.next), 302), identity));
  } catch (err) {
    const code = err instanceof AuthFlowError ? err.code : "server_error";
    if (code === "exchange_failed" || code === "server_error") {
      console.error("[auth] Google callback failed:", err instanceof Error ? err.message : "unknown error");
    } else {
      // Every other outcome is logged too (a code only, never a token or an email), so a failed sign-in can be traced.
      console.warn("[auth] Google callback refused:", code, flow ? "(flow cookie present)" : "(no flow cookie)");
    }
    const res = redirectWithError(request, code, flow ? safeNext(flow.next) : undefined);
    // The flow cookie is single-use once this flow's own answer arrives, whatever
    // the outcome. A callback without its state is someone else's link: clearing
    // the cookie for it would let any site cancel a sign-in in progress.
    return code === "state_mismatch" ? res : clearFlow(res);
  }
}
