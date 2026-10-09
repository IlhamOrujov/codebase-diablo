import type { NextRequest } from "next/server";
import { isSameOrigin, redirectTo, setSession } from "@/lib/auth/http";
import { safeNext } from "@/lib/auth/next-path";
import { DEMO_USER } from "@/lib/auth/types";
import { DEMO_MODE } from "@/lib/demo-mode";

/**
 * "Enter demo workspace": a real server-side session, flagged demo. A POST
 * from our own origin only, so another site cannot sign a visitor in.
 */
export async function POST(request: NextRequest) {
  // Production is Google sign-in only; the demo exists only in demo mode (the end-to-end tests).
  if (!DEMO_MODE) return new Response("Not found", { status: 404 });
  if (!isSameOrigin(request)) return new Response("Forbidden", { status: 403 });
  let next: string | null = request.nextUrl.searchParams.get("next");
  const type = request.headers.get("content-type") ?? "";
  if (!next && (type.startsWith("application/x-www-form-urlencoded") || type.startsWith("multipart/form-data"))) {
    const value = (await request.formData().catch(() => null))?.get("next");
    next = typeof value === "string" ? value : null;
  }
  return setSession(redirectTo(request, safeNext(next)), { ...DEMO_USER, provider: "demo" });
}
