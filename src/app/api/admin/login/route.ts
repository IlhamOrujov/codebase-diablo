import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, adminCookieOptions, issueAdminToken, passwordMatches } from "@/lib/admin/auth";
import { isSameOrigin } from "@/lib/auth/http";

/** POST /api/admin/login { password }: sets the admin cookie on a match. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let password = "";
  try {
    const body = (await request.json()) as { password?: unknown };
    if (typeof body.password === "string") password = body.password.slice(0, 200);
  } catch {}
  if (!process.env.ADMIN_PASSWORD?.trim()) {
    return NextResponse.json({ error: "not_configured", message: "ADMIN_PASSWORD is not set on the server." }, { status: 503 });
  }
  if (!passwordMatches(password)) {
    // A short pause makes guessing slow.
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "wrong_password", message: "Wrong password." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  res.cookies.set(ADMIN_COOKIE, await issueAdminToken(), adminCookieOptions());
  return res;
}
