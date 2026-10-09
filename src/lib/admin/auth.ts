import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { authSecret, secureCookies } from "@/lib/auth/env";

/** The admin pass is a separate, short-lived cookie, unlocked with ADMIN_PASSWORD. */
export const ADMIN_COOKIE = "diablo_admin";
const TTL_SECONDS = 12 * 60 * 60;

const key = () => new TextEncoder().encode(`admin:${authSecret()}`);
const digest = (s: string) => createHash("sha256").update(s).digest();

/** Constant-time check of the typed password against ADMIN_PASSWORD. False when it is not set. */
export function passwordMatches(typed: string): boolean {
  const expected = process.env.ADMIN_PASSWORD?.trim();
  if (!expected || !typed) return false;
  return timingSafeEqual(digest(typed), digest(expected));
}

export async function issueAdminToken(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(key());
}

export async function isAdminToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return payload.role === "admin";
  } catch {
    return false;
  }
}

export const adminCookieOptions = () => ({
  httpOnly: true,
  secure: secureCookies(),
  sameSite: "strict" as const,
  path: "/",
  maxAge: TTL_SECONDS,
});
