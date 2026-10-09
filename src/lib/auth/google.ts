import "server-only";
import { createRemoteJWKSet, customFetch, jwtVerify, SignJWT, type FetchImplementation, type JWTPayload, type JWTVerifyGetKey } from "jose";
import type { GoogleConfig } from "./env";
import type { SessionInput } from "./session";

/**
 * Google sign-in: OAuth 2.0 Authorization Code flow with PKCE (S256), a
 * `state` and an OpenID Connect `nonce`, done with plain fetch. The verifier,
 * state, nonce and `next` travel in a short-lived signed cookie scoped to the
 * callback path. The ID token's signature is checked against Google's
 * published keys before any claim in it is trusted.
 */
export const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
export const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
export const OAUTH_COOKIE = "diablo_oauth";
export const OAUTH_COOKIE_PATH = "/api/auth/google";
export const OAUTH_TTL_SECONDS = 10 * 60;
export const CALLBACK_PATH = "/api/auth/google/callback";
/** Leeway for clock skew between this server and Google, in seconds. */
export const CLOCK_TOLERANCE_SECONDS = 60;

/** Errors the login page knows how to explain (`/?error=<code>`). */
export type AuthErrorCode = "google_unavailable" | "access_denied" | "state_mismatch" | "exchange_failed" | "unverified_email" | "server_error";

export class AuthFlowError extends Error {
  constructor(public readonly code: AuthErrorCode, message?: string) {
    super(message ?? code);
    this.name = "AuthFlowError";
  }
}

const b64url = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");

export function randomToken(bytes = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return b64url(new Uint8Array(digest));
}

export function redirectUri(origin: string): string {
  return new URL(CALLBACK_PATH, origin).toString();
}

export async function authorizationUrl(config: GoogleConfig, origin: string, flow: Pick<FlowState, "state" | "verifier" | "nonce">): Promise<URL> {
  const url = new URL(GOOGLE_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", redirectUri(origin));
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", flow.state);
  url.searchParams.set("nonce", flow.nonce);
  url.searchParams.set("code_challenge", await pkceChallenge(flow.verifier));
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  return url;
}

// ── The flow cookie ──────────────────────────────────────────────

export interface FlowState {
  state: string;
  verifier: string;
  /** OIDC nonce: Google copies it into the ID token, binding the token to this cookie. */
  nonce: string;
  next: string;
}

/** A fresh flow: unguessable state, PKCE verifier and nonce. */
export function newFlow(next: string): FlowState {
  return { state: randomToken(), verifier: randomToken(48), nonce: randomToken(), next };
}

const key = (secret: string) => new TextEncoder().encode(secret);

export async function sealFlow(flow: FlowState, secret: string): Promise<string> {
  return new SignJWT({ st: flow.state, cv: flow.verifier, nn: flow.nonce, nx: flow.next })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience("diablo-oauth")
    .setIssuedAt()
    .setExpirationTime(`${OAUTH_TTL_SECONDS}s`)
    .sign(key(secret));
}

export async function openFlow(token: string | undefined, secret: string): Promise<FlowState | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ["HS256"], audience: "diablo-oauth" });
    const { st, cv, nn, nx } = payload;
    if (typeof st !== "string" || typeof cv !== "string" || typeof nn !== "string" || typeof nx !== "string") return null;
    if (!st || !cv || !nn) return null;
    return { state: st, verifier: cv, nonce: nn, next: nx };
  } catch {
    return null;
  }
}

/** Constant-time string comparison for the state and nonce. */
export function sameToken(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Checks the callback's query against the flow cookie. Returns the code to
 * exchange with the flow it belongs to, or throws an AuthFlowError naming
 * what went wrong.
 *
 * The state is checked first, even for Google's `?error=`: Google echoes the
 * state on errors too (RFC 6749 §4.1.2.1), so an error without this flow's
 * state did not come from this flow, and anyone can link to the callback.
 * `state_mismatch` therefore means "not this flow's answer", and the route
 * leaves the visitor's flow cookie alone for it.
 */
export function checkCallback(params: URLSearchParams, flow: FlowState | null): { code: string; flow: FlowState } {
  const state = params.get("state");
  if (!flow || !state || !sameToken(state, flow.state)) throw new AuthFlowError("state_mismatch");
  const error = params.get("error");
  // The value is attacker-controlled and ends up in the server log: keep it to one short, plain token.
  if (error) throw new AuthFlowError(error === "access_denied" ? "access_denied" : "server_error", `Google returned ${error.replace(/[^\w.-]/g, "?").slice(0, 64)}`);
  const code = params.get("code");
  if (!code) throw new AuthFlowError("exchange_failed", "No authorization code");
  return { code, flow };
}

// ── The ID token ─────────────────────────────────────────────────

/**
 * Google's signing keys, fetched on first use and cached by jose for ten
 * minutes; a token signed with a key we have not seen triggers a refetch
 * (at most every 30 s). One set per server instance.
 */
let googleKeys: JWTVerifyGetKey | undefined;
export function googleSigningKeys(): JWTVerifyGetKey {
  googleKeys ??= createGoogleJwks();
  return googleKeys;
}

/** A remote key set for Google's JWKS URL; tests pass their own fetch. */
export function createGoogleJwks(fetchImpl?: FetchImplementation): JWTVerifyGetKey {
  return createRemoteJWKSet(new URL(GOOGLE_JWKS_URL), {
    timeoutDuration: 5_000,
    ...(fetchImpl ? { [customFetch]: fetchImpl } : {}),
  });
}

export interface IdTokenCheck {
  clientId: string;
  /** The nonce from the flow cookie; the token must carry exactly this. */
  nonce: string;
  /** Google's public keys (default: the cached remote set). */
  keys?: JWTVerifyGetKey;
  /** Epoch seconds, for tests. */
  now?: number;
}

/**
 * Verifies a Google ID token and returns the identity in it. In order: the
 * RS256 signature against Google's keys, then issuer, audience (and `azp`),
 * expiry and issue time, then the nonce, then a verified email. Throws
 * AuthFlowError; `unverified_email` is the only one the visitor can fix.
 */
export async function verifyIdToken(idToken: string, check: IdTokenCheck): Promise<SessionInput> {
  let claims: JWTPayload;
  try {
    ({ payload: claims } = await jwtVerify(idToken, check.keys ?? googleSigningKeys(), {
      algorithms: ["RS256"],
      issuer: GOOGLE_ISSUERS,
      audience: check.clientId,
      requiredClaims: ["exp", "iat", "sub"],
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
      currentDate: check.now === undefined ? undefined : new Date(check.now * 1000),
    }));
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? String(err.code) : "unknown";
    throw new AuthFlowError("exchange_failed", `ID token rejected (${code})`);
  }

  // OIDC Core §3.1.3.7: with an authorized party present, it must be us.
  if (claims.azp !== undefined && claims.azp !== check.clientId) throw new AuthFlowError("exchange_failed", "ID token authorized for another client");
  if (Array.isArray(claims.aud) && claims.aud.length > 1 && claims.azp !== check.clientId) {
    throw new AuthFlowError("exchange_failed", "ID token has several audiences and no matching azp");
  }
  // The nonce binds this token to the flow cookie of the browser that started it.
  if (typeof claims.nonce !== "string" || !sameToken(claims.nonce, check.nonce)) throw new AuthFlowError("exchange_failed", "ID token nonce mismatch");
  if (typeof claims.sub !== "string" || !claims.sub) throw new AuthFlowError("exchange_failed", "ID token has no subject");

  const email = typeof claims.email === "string" ? claims.email : null;
  if (email && claims.email_verified !== true) throw new AuthFlowError("unverified_email");

  const rawName = typeof claims.name === "string" ? claims.name.trim() : "";
  const name = rawName || (email?.split("@")[0] ?? "Researcher");
  return { id: `google:${claims.sub}`, name: name.slice(0, 120), email, provider: "google" };
}

// ── Code exchange ────────────────────────────────────────────────

export interface ExchangeOptions {
  /** The token endpoint's fetch (tests mock it). */
  fetch?: typeof fetch;
  keys?: JWTVerifyGetKey;
  now?: number;
}

/**
 * Exchanges the code (with the PKCE verifier) for tokens, then verifies the
 * ID token (signature, claims and the flow's nonce) and returns the identity.
 */
export async function exchangeCode(
  config: GoogleConfig,
  origin: string,
  flow: { code: string; verifier: string; nonce: string },
  options: ExchangeOptions = {},
): Promise<SessionInput> {
  const fetchImpl = options.fetch ?? fetch;
  let res: Response;
  try {
    res = await fetchImpl(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: flow.code,
        code_verifier: flow.verifier,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: redirectUri(origin),
      }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new AuthFlowError("exchange_failed", "Token endpoint unreachable");
  }
  if (!res.ok) throw new AuthFlowError("exchange_failed", `Token endpoint answered ${res.status}`);
  const body = (await res.json().catch(() => null)) as { id_token?: unknown } | null;
  if (!body || typeof body.id_token !== "string") throw new AuthFlowError("exchange_failed", "No ID token");

  return verifyIdToken(body.id_token, { clientId: config.clientId, nonce: flow.nonce, keys: options.keys, now: options.now });
}
