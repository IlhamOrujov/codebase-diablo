import { NextResponse, type NextRequest } from "next/server";
import { authSecret } from "@/lib/auth/env";
import { isSameOrigin } from "@/lib/auth/http";
import { safeNext } from "@/lib/auth/next-path";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { SEED_IDS } from "@/lib/data/seeds";
import { CREATED_ID } from "@/lib/slug";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Runs before every app route (see `matcher`):
 *
 * 1. Authentication. The workspace needs a valid, signed session cookie;
 *    without one the visitor goes to sign-in (`/`) with `?next=` set. A
 *    signed-in visitor to `/` goes straight on to `?next=` (sanitised) or
 *    the workspace. A cookie that fails verification is deleted. The (app)
 *    layout verifies again through the data access layer.
 * 2. CSRF. A state-changing request (anything but GET, HEAD, OPTIONS) to an
 *    app API route must come from our own origin, whatever its route handler
 *    remembers to check. SameSite=Lax alone would still let a sibling
 *    subdomain (same site, other origin) post with the visitor's cookie.
 * 3. Real 404s for investigation URLs that cannot exist. The page streams,
 *    and once streaming starts the status is already 200, so the check has
 *    to happen here. Seeded ids and ids with the shape the app creates pass;
 *    anything else renders the branded not-found page with status 404.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/api/") && !SAFE_METHODS.has(request.method) && !isSameOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value, authSecret());

  if (pathname === "/") {
    if (session) return redirect(request, safeNext(request.nextUrl.searchParams.get("next")));
    return dropInvalidCookie(request, NextResponse.next());
  }

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return dropInvalidCookie(request, NextResponse.json({ error: "unauthenticated" }, { status: 401, headers: { "Cache-Control": "no-store" } }));
    }
    const login = new URL("/", request.url);
    login.searchParams.set("next", pathname + search);
    return dropInvalidCookie(request, redirect(request, login));
  }

  if (pathname.startsWith("/investigations/")) return investigation(request);
  return NextResponse.next();
}

/** A stale or forged session cookie is useless; drop it. Only called when verification failed. */
function dropInvalidCookie(request: NextRequest, res: NextResponse) {
  if (request.cookies.has(SESSION_COOKIE)) res.cookies.delete(SESSION_COOKIE);
  return res;
}

function redirect(request: NextRequest, to: string | URL) {
  const res = NextResponse.redirect(new URL(to, request.url));
  res.headers.set("Cache-Control", "no-store");
  return res;
}

function investigation(request: NextRequest) {
  const parts = request.nextUrl.pathname.split("/");
  let id = parts[2] ?? "";
  try {
    id = decodeURIComponent(id);
  } catch {
    id = "";
  }
  const ok = parts.length === 3 && ((SEED_IDS as readonly string[]).includes(id) || CREATED_ID.test(id));
  if (ok) return NextResponse.next();
  return NextResponse.rewrite(new URL("/__not-found", request.url), { status: 404 });
}

export const config = {
  // Every route in the (app) group, the sign-in page, and app API routes
  // (everything under /api except the auth endpoints and /api/admin, which
  // check their own admin password cookie and same-origin requests).
  matcher: [
    "/",
    "/home/:path*",
    "/investigations/:path*",
    "/live/:path*",
    "/systems/:path*",
    "/experiments/:path*",
    "/evidence/:path*",
    "/reports/:path*",
    "/datasets/:path*",
    "/settings/:path*",
    "/design/:path*",
    "/api/((?!auth/|admin/).*)",
  ],
};
