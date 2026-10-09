import "server-only";

/**
 * The one place auth reads the environment. Values are read lazily, at
 * request time, so `next build` never needs secrets.
 *
 *   AUTH_SECRET           signs session cookies; required in production
 *   GOOGLE_CLIENT_ID      Google OAuth web client (optional)
 *   GOOGLE_CLIENT_SECRET
 *   APP_ORIGIN            public origin for the OAuth redirect URI,
 *                         e.g. https://app.diablo.pnoia.dev (defaults to the request's)
 */

const MIN_SECRET_LENGTH = 32;
const isProd = () => process.env.NODE_ENV === "production";

type DevGlobal = typeof globalThis & { __diabloDevAuthSecret?: string };

export function authSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (secret && secret.length >= MIN_SECRET_LENGTH) return secret;
  if (isProd()) {
    throw new Error(
      secret
        ? `AUTH_SECRET must be at least ${MIN_SECRET_LENGTH} characters.`
        : "AUTH_SECRET is not set. Generate one with `openssl rand -base64 32` and add it to the environment.",
    );
  }
  // Development only: one random secret per server process, so sessions
  // survive hot reloads but not restarts.
  const g = globalThis as DevGlobal;
  if (!g.__diabloDevAuthSecret) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    g.__diabloDevAuthSecret = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    console.warn("[auth] AUTH_SECRET is not set; using an ephemeral development secret. Sessions end when the server restarts.");
  }
  return g.__diabloDevAuthSecret;
}

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
}

export function googleConfig(): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export const isGoogleConfigured = () => googleConfig() !== null;

/** The public origin: APP_ORIGIN when set (behind proxies), else the request's own. */
export function appOrigin(requestOrigin: string): string {
  const configured = process.env.APP_ORIGIN?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // Fall through to the request origin.
    }
  }
  return requestOrigin;
}

/** Secure cookies everywhere except plain-http development. */
export const secureCookies = () => isProd();
