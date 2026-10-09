import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/dal";
import { getSystemSettings } from "@/lib/admin/settings";

/** GET /api/live/options: which investigator model the system uses right now. Never returns a key. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const { reasoner } = await getSystemSettings();
  const gemini = reasoner === "gemini" && !!process.env.GEMINI_API_KEY?.trim();
  return NextResponse.json({ reasoner: gemini ? "gemini" : "claude" }, { headers: { "Cache-Control": "no-store" } });
}
