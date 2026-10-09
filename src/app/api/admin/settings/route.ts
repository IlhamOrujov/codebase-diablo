import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, isAdminToken } from "@/lib/admin/auth";
import { getSystemSettings, setSystemSettings } from "@/lib/admin/settings";
import { isSameOrigin } from "@/lib/auth/http";

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  if (!(await isAdminToken(request.cookies.get(ADMIN_COOKIE)?.value))) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  return NextResponse.json(await getSystemSettings(), { headers: noStore });
}

/** POST /api/admin/settings { reasoner: "claude" | "gemini" }: admins only. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403, headers: noStore });
  if (!(await isAdminToken(request.cookies.get(ADMIN_COOKIE)?.value))) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  let reasoner: "claude" | "gemini" | undefined;
  try {
    const body = (await request.json()) as { reasoner?: unknown };
    if (body.reasoner === "claude" || body.reasoner === "gemini") reasoner = body.reasoner;
  } catch {}
  if (!reasoner) return NextResponse.json({ error: "bad_request", message: "reasoner must be claude or gemini." }, { status: 400, headers: noStore });
  if (reasoner === "gemini" && !process.env.GEMINI_API_KEY?.trim()) {
    return NextResponse.json({ error: "not_configured", message: "GEMINI_API_KEY is not set on the server." }, { status: 409, headers: noStore });
  }
  try {
    return NextResponse.json(await setSystemSettings({ reasoner }), { headers: noStore });
  } catch (e) {
    return NextResponse.json({ error: "store_failed", message: e instanceof Error ? e.message : "Could not save." }, { status: 500, headers: noStore });
  }
}
