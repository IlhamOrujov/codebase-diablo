import type { NextRequest } from "next/server";
import { clearSession, isSameOrigin, redirectTo } from "@/lib/auth/http";

/** Ends the session (the cookie is the session) and returns to sign-in. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return new Response("Forbidden", { status: 403 });
  return clearSession(redirectTo(request, "/"));
}
