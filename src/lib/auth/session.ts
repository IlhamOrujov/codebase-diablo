import { jwtVerify, SignJWT } from "jose";
import { DEMO_MODE } from "@/lib/demo-mode";
import { DEMO_USER, initialsOf, type AuthProvider, type Session } from "./types";

/**
 * Stateless sessions: a signed JWT (HS256) in an httpOnly cookie. No database;
 * the cookie is the session. Pure functions, so the proxy, route handlers and
 * unit tests share them; the secret is always passed in.
 */
export const SESSION_COOKIE = "diablo_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const ISSUER = "diablo";
const AUDIENCE = "diablo-app";
const ALG = "HS256";

export interface SessionInput {
  id: string;
  name: string;
  email: string | null;
  provider: AuthProvider;
}

const key = (secret: string) => new TextEncoder().encode(secret);

export async function signSession(input: SessionInput, secret: string, now = Math.floor(Date.now() / 1000)): Promise<string> {
  return new SignJWT({ name: input.name, email: input.email, provider: input.provider })
    .setProtectedHeader({ alg: ALG, typ: "JWT" })
    .setSubject(input.id)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_TTL_SECONDS)
    .sign(key(secret));
}

/** The session in a token, or null when it is missing, forged, expired or malformed. */
export async function verifySession(token: string | undefined | null, secret: string, now?: number): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      algorithms: [ALG],
      issuer: ISSUER,
      audience: AUDIENCE,
      currentDate: now === undefined ? undefined : new Date(now * 1000),
    });
    const provider = payload.provider;
    if (provider !== "google" && provider !== "demo") return null;
    if (provider === "demo" && !DEMO_MODE) return null;
    if (typeof payload.sub !== "string" || typeof payload.exp !== "number") return null;
    const name = typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : DEMO_USER.name;
    const email = typeof payload.email === "string" ? payload.email : null;
    const demo = provider === "demo";
    return {
      user: { id: payload.sub, name, initials: initialsOf(name), email },
      workspace: demo ? "Demo workspace" : "Personal workspace",
      provider,
      demo,
      expiresAt: payload.exp,
    };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = (secure: boolean) => ({
  httpOnly: true,
  secure,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
});
