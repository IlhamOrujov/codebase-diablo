import { beforeAll, describe, expect, it, vi } from "vitest";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type CryptoKey, type FetchImplementation, type JWK, type JWTVerifyGetKey } from "jose";
import {
  AuthFlowError,
  authorizationUrl,
  checkCallback,
  createGoogleJwks,
  exchangeCode,
  GOOGLE_JWKS_URL,
  GOOGLE_TOKEN_URL,
  newFlow,
  openFlow,
  pkceChallenge,
  sameToken,
  sealFlow,
  verifyIdToken,
} from "./google";

const SECRET = "test-secret-0123456789-abcdefghijklmnopqrstuvwxyz";
const CONFIG = { clientId: "client-123.apps.googleusercontent.com", clientSecret: "shh" };
const ORIGIN = "https://diablo.example";
const NOW = 1_800_000_000;
const NONCE = "n0nce-from-the-flow-cookie";
const KID = "google-test-key-1";

// A locally generated stand-in for Google's signing key, published through a
// local JWKS. Nothing here touches the network.
let googleKey: CryptoKey;
let attackerKey: CryptoKey;
let jwk: JWK;
let keys: JWTVerifyGetKey;

beforeAll(async () => {
  const google = await generateKeyPair("RS256");
  const attacker = await generateKeyPair("RS256");
  googleKey = google.privateKey;
  attackerKey = attacker.privateKey;
  jwk = { ...(await exportJWK(google.publicKey)), kid: KID, alg: "RS256", use: "sig" };
  keys = createLocalJWKSet({ keys: [jwk] });
});

const goodClaims = {
  iss: "https://accounts.google.com",
  aud: CONFIG.clientId,
  azp: CONFIG.clientId,
  sub: "1234567890",
  iat: NOW - 10,
  exp: NOW + 3600,
  nonce: NONCE,
  email: "ada@example.com",
  email_verified: true,
  name: "Ada Lovelace",
};

/** An ID token as Google would sign it; `with` swaps the key, kid or alg. */
async function idToken(claims: Record<string, unknown>, opts: { key?: CryptoKey | Uint8Array; kid?: string; alg?: string } = {}) {
  return new SignJWT(claims).setProtectedHeader({ alg: opts.alg ?? "RS256", kid: opts.kid ?? KID, typ: "JWT" }).sign(opts.key ?? googleKey);
}

const verify = (token: string, nonce = NONCE) => verifyIdToken(token, { clientId: CONFIG.clientId, nonce, keys, now: NOW });

/** The AuthFlowError code a promise rejects with, or null when it resolves. */
async function rejection(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    return e instanceof AuthFlowError ? e.code : `other: ${String(e)}`;
  }
}

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof AuthFlowError ? e.code : "other";
  }
  return null;
};

describe("PKCE and the authorization URL", () => {
  it("derives the RFC 7636 S256 challenge", async () => {
    // Appendix B of RFC 7636.
    expect(await pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("builds an authorization URL with state, nonce, S256 challenge and the callback", async () => {
    const url = await authorizationUrl(CONFIG, ORIGIN, { state: "st4te", verifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk", nonce: NONCE });
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    const q = url.searchParams;
    expect(q.get("response_type")).toBe("code");
    expect(q.get("client_id")).toBe(CONFIG.clientId);
    expect(q.get("redirect_uri")).toBe("https://diablo.example/api/auth/google/callback");
    expect(q.get("state")).toBe("st4te");
    expect(q.get("nonce")).toBe(NONCE);
    expect(q.get("code_challenge")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
    expect(q.get("code_challenge_method")).toBe("S256");
    expect(q.get("scope")).toBe("openid email profile");
    expect(q.has("client_secret")).toBe(false);
  });

  it("starts every flow with a fresh, unguessable state, verifier and nonce", () => {
    const a = newFlow("/settings");
    const b = newFlow("/settings");
    expect(a.next).toBe("/settings");
    for (const k of ["state", "verifier", "nonce"] as const) {
      expect(a[k]).toMatch(/^[A-Za-z0-9_-]{43,}$/);
      expect(a[k]).not.toBe(b[k]);
    }
    expect(new Set([a.state, a.verifier, a.nonce]).size).toBe(3);
  });
});

describe("flow cookie and state", () => {
  it("seals and opens the flow, nonce included; rejects another secret and garbage", async () => {
    const flow = { state: "abc", verifier: "v".repeat(64), nonce: NONCE, next: "/settings" };
    const sealed = await sealFlow(flow, SECRET);
    expect(await openFlow(sealed, SECRET)).toEqual(flow);
    expect(await openFlow(sealed, "another-secret-0123456789-abcdefghijklmn")).toBeNull();
    expect(await openFlow("garbage", SECRET)).toBeNull();
    expect(await openFlow(undefined, SECRET)).toBeNull();
  });

  it("refuses a flow cookie without a nonce (one sealed before nonces existed)", async () => {
    const legacy = await new SignJWT({ st: "abc", cv: "v", nx: "/home" })
      .setProtectedHeader({ alg: "HS256" })
      .setAudience("diablo-oauth")
      .setIssuedAt()
      .setExpirationTime("10m")
      .sign(new TextEncoder().encode(SECRET));
    expect(await openFlow(legacy, SECRET)).toBeNull();
  });

  it("compares state tokens exactly", () => {
    expect(sameToken("abc", "abc")).toBe(true);
    expect(sameToken("abc", "abd")).toBe(false);
    expect(sameToken("abc", "abcd")).toBe(false);
    expect(sameToken("", "")).toBe(false);
  });

  it("accepts a callback whose state matches the cookie", () => {
    const flow = { state: "s1", verifier: "v", nonce: NONCE, next: "/home" };
    expect(checkCallback(new URLSearchParams({ code: "c0de", state: "s1" }), flow)).toEqual({ code: "c0de", flow });
  });

  it("rejects a missing cookie, a missing or different state, and a missing code", () => {
    const flow = { state: "s1", verifier: "v", nonce: NONCE, next: "/home" };
    expect(code(() => checkCallback(new URLSearchParams({ code: "c", state: "s1" }), null))).toBe("state_mismatch");
    expect(code(() => checkCallback(new URLSearchParams({ code: "c" }), flow))).toBe("state_mismatch");
    expect(code(() => checkCallback(new URLSearchParams({ code: "c", state: "s2" }), flow))).toBe("state_mismatch");
    expect(code(() => checkCallback(new URLSearchParams({ state: "s1" }), flow))).toBe("exchange_failed");
  });

  it("maps Google's ?error= when it carries this flow's state", () => {
    const flow = { state: "s1", verifier: "v", nonce: NONCE, next: "/home" };
    expect(code(() => checkCallback(new URLSearchParams({ error: "access_denied", state: "s1" }), flow))).toBe("access_denied");
    expect(code(() => checkCallback(new URLSearchParams({ error: "server_error", state: "s1" }), flow))).toBe("server_error");
    expect(code(() => checkCallback(new URLSearchParams({ error: "access_denied", state: "s1", code: "c" }), flow))).toBe("access_denied");
  });

  it("treats an ?error= without this flow's state as someone else's link", () => {
    const flow = { state: "s1", verifier: "v", nonce: NONCE, next: "/home" };
    expect(code(() => checkCallback(new URLSearchParams({ error: "access_denied" }), flow))).toBe("state_mismatch");
    expect(code(() => checkCallback(new URLSearchParams({ error: "access_denied", state: "s2" }), flow))).toBe("state_mismatch");
    expect(code(() => checkCallback(new URLSearchParams({ error: "access_denied", state: "s1" }), null))).toBe("state_mismatch");
  });

  it("keeps an attacker's ?error= out of the log as anything but one short token", () => {
    try {
      checkCallback(new URLSearchParams({ error: `x\n[auth] forged line ${"y".repeat(200)}`, state: "s1" }), { state: "s1", verifier: "v", nonce: NONCE, next: "/home" });
    } catch (e) {
      expect((e as Error).message).toMatch(/^Google returned [\w.?-]{1,64}$/);
      return;
    }
    throw new Error("expected checkCallback to throw");
  });
});

describe("verifyIdToken (local key pair, mocked JWKS)", () => {
  it("accepts a token signed with Google's key and returns the identity", async () => {
    expect(await verify(await idToken(goodClaims))).toEqual({ id: "google:1234567890", name: "Ada Lovelace", email: "ada@example.com", provider: "google" });
    // Google uses both issuer spellings.
    expect((await verify(await idToken({ ...goodClaims, iss: "accounts.google.com" }))).id).toBe("google:1234567890");
  });

  it("rejects a wrong signature: another key under Google's key id", async () => {
    expect(await rejection(verify(await idToken(goodClaims, { key: attackerKey })))).toBe("exchange_failed");
  });

  it("rejects a payload changed after signing", async () => {
    const [h, , s] = (await idToken(goodClaims)).split(".");
    const forged = Buffer.from(JSON.stringify({ ...goodClaims, sub: "someone-else" })).toString("base64url");
    expect(await rejection(verify(`${h}.${forged}.${s}`))).toBe("exchange_failed");
  });

  it("rejects an unknown key id, an HMAC-signed token and alg=none", async () => {
    expect(await rejection(verify(await idToken(goodClaims, { kid: "not-a-google-key" })))).toBe("exchange_failed");
    const hmac = await idToken(goodClaims, { alg: "HS256", key: new TextEncoder().encode("anyone-can-pick-this-secret-0123456789") });
    expect(await rejection(verify(hmac))).toBe("exchange_failed");
    const none = `${Buffer.from(JSON.stringify({ alg: "none", kid: KID })).toString("base64url")}.${Buffer.from(JSON.stringify(goodClaims)).toString("base64url")}.`;
    expect(await rejection(verify(none))).toBe("exchange_failed");
    expect(await rejection(verify("not-a-jwt"))).toBe("exchange_failed");
  });

  it("rejects a token for another app or from another issuer", async () => {
    expect(await rejection(verify(await idToken({ ...goodClaims, aud: "someone-else.apps.googleusercontent.com" })))).toBe("exchange_failed");
    expect(await rejection(verify(await idToken({ ...goodClaims, iss: "https://evil.example" })))).toBe("exchange_failed");
    // Issued to another client that merely lists us as an audience.
    expect(await rejection(verify(await idToken({ ...goodClaims, azp: "someone-else" })))).toBe("exchange_failed");
    expect(await rejection(verify(await idToken({ ...goodClaims, aud: [CONFIG.clientId, "other"], azp: undefined })))).toBe("exchange_failed");
  });

  it("rejects an expired token, allowing a minute of clock skew", async () => {
    expect(await rejection(verify(await idToken({ ...goodClaims, iat: NOW - 7200, exp: NOW - 3600 })))).toBe("exchange_failed");
    expect(await rejection(verify(await idToken({ ...goodClaims, exp: NOW - 30 })))).toBeNull();
    expect(await rejection(verify(await idToken({ ...goodClaims, exp: undefined })))).toBe("exchange_failed");
    expect(await rejection(verify(await idToken({ ...goodClaims, iat: undefined })))).toBe("exchange_failed");
  });

  it("rejects a nonce that is missing or belongs to another flow", async () => {
    expect(await rejection(verify(await idToken(goodClaims), "a-different-flow-nonce"))).toBe("exchange_failed");
    expect(await rejection(verify(await idToken({ ...goodClaims, nonce: undefined })))).toBe("exchange_failed");
    expect(await rejection(verify(await idToken({ ...goodClaims, nonce: `${NONCE}x` })))).toBe("exchange_failed");
  });

  it("rejects an unverified email, and only after the signature checks out", async () => {
    expect(await rejection(verify(await idToken({ ...goodClaims, email_verified: false })))).toBe("unverified_email");
    expect(await rejection(verify(await idToken({ ...goodClaims, email_verified: "true" })))).toBe("unverified_email");
    expect(await rejection(verify(await idToken({ ...goodClaims, email_verified: false }, { key: attackerKey })))).toBe("exchange_failed");
  });

  it("falls back to the email's local part when there is no name", async () => {
    expect((await verify(await idToken({ ...goodClaims, name: undefined }))).name).toBe("ada");
  });
});

describe("Google's JWKS endpoint (fetch mocked)", () => {
  const jwksFetch = (respond: () => Promise<Response>) => vi.fn<FetchImplementation>(respond);
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

  it("fetches Google's published keys once, then verifies from the cache", async () => {
    const fetchKeys = jwksFetch(async () => json({ keys: [jwk] }));
    const remote = createGoogleJwks(fetchKeys);
    const check = { clientId: CONFIG.clientId, nonce: NONCE, keys: remote, now: NOW };
    expect((await verifyIdToken(await idToken(goodClaims), check)).id).toBe("google:1234567890");
    expect((await verifyIdToken(await idToken(goodClaims), check)).id).toBe("google:1234567890");
    expect(fetchKeys).toHaveBeenCalledTimes(1);
    expect(fetchKeys.mock.calls[0][0]).toBe(GOOGLE_JWKS_URL);
    expect(fetchKeys.mock.calls[0][1].method).toBe("GET");
  });

  it("fails closed when the keys cannot be fetched", async () => {
    const offline = createGoogleJwks(jwksFetch(async () => Promise.reject(new TypeError("offline"))));
    expect(await rejection(verifyIdToken(await idToken(goodClaims), { clientId: CONFIG.clientId, nonce: NONCE, keys: offline, now: NOW }))).toBe("exchange_failed");
    const broken = createGoogleJwks(jwksFetch(async () => new Response("oops", { status: 500 })));
    expect(await rejection(verifyIdToken(await idToken(goodClaims), { clientId: CONFIG.clientId, nonce: NONCE, keys: broken, now: NOW }))).toBe("exchange_failed");
  });
});

describe("exchangeCode (network mocked)", () => {
  const tokenResponse = (body: unknown, status = 200) =>
    vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
  const exchange = (fetchMock: typeof fetch, nonce = NONCE) =>
    exchangeCode(CONFIG, ORIGIN, { code: "c0de", verifier: "verifier-xyz", nonce }, { fetch: fetchMock, keys, now: NOW });

  it("posts the code with the PKCE verifier and returns the verified identity", async () => {
    const fetchMock = tokenResponse({ id_token: await idToken(goodClaims), access_token: "x" });
    expect(await exchange(fetchMock)).toEqual({ id: "google:1234567890", name: "Ada Lovelace", email: "ada@example.com", provider: "google" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(GOOGLE_TOKEN_URL);
    expect(init?.method).toBe("POST");
    const body = new URLSearchParams(String(init?.body));
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("c0de");
    expect(body.get("code_verifier")).toBe("verifier-xyz");
    expect(body.get("redirect_uri")).toBe("https://diablo.example/api/auth/google/callback");
  });

  it("rejects token errors, missing ID tokens and network failures", async () => {
    expect(await rejection(exchange(tokenResponse({ error: "invalid_grant" }, 400)))).toBe("exchange_failed");
    expect(await rejection(exchange(tokenResponse({ access_token: "x" })))).toBe("exchange_failed");
    expect(await rejection(exchange(tokenResponse({ id_token: "not-a-jwt" })))).toBe("exchange_failed");
    expect(await rejection(exchange(vi.fn<typeof fetch>(async () => Promise.reject(new TypeError("offline")))))).toBe("exchange_failed");
  });

  it("refuses an ID token that is unsigned, mis-signed or minted for another flow", async () => {
    // The old check read claims without a signature; a well-formed HMAC token passed it.
    const unsigned = await idToken(goodClaims, { alg: "HS256", key: new TextEncoder().encode("google-would-sign-this-0123456789abcdef") });
    expect(await rejection(exchange(tokenResponse({ id_token: unsigned })))).toBe("exchange_failed");
    expect(await rejection(exchange(tokenResponse({ id_token: await idToken(goodClaims, { key: attackerKey }) })))).toBe("exchange_failed");
    expect(await rejection(exchange(tokenResponse({ id_token: await idToken(goodClaims) }), "another-flow"))).toBe("exchange_failed");
  });

  it("reports an unverified email as such", async () => {
    expect(await rejection(exchange(tokenResponse({ id_token: await idToken({ ...goodClaims, email_verified: false }) })))).toBe("unverified_email");
  });
});
