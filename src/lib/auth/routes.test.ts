import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { exportJWK, generateKeyPair, SignJWT, type CryptoKey, type JWK } from "jose";
import { POST as demo } from "@/app/api/auth/demo/route";
import { GET as startGoogle } from "@/app/api/auth/google/route";
import { GET as googleCallback } from "@/app/api/auth/google/callback/route";
import { POST as signout } from "@/app/api/auth/signout/route";
import { GOOGLE_JWKS_URL, GOOGLE_TOKEN_URL, OAUTH_COOKIE, openFlow, sealFlow, type FlowState } from "./google";
import { SESSION_COOKIE, verifySession } from "./session";

/**
 * The auth route handlers, called directly with real NextRequests. Google's
 * token endpoint and key set are a stubbed global fetch serving a locally
 * generated key pair: nothing here touches the network.
 */
const SECRET = "routes-test-secret-0123456789-abcdefghijklmnop";
const ORIGIN = "http://localhost:3000";
const CLIENT_ID = "client-123.apps.googleusercontent.com";

let googleKey: CryptoKey;
let otherKey: CryptoKey;
let jwk: JWK;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  googleKey = pair.privateKey;
  otherKey = (await generateKeyPair("RS256")).privateKey;
  jwk = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256", use: "sig" };
});

beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", SECRET);
  vi.stubEnv("APP_ORIGIN", "");
  vi.stubEnv("GOOGLE_CLIENT_ID", "");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const withGoogle = () => {
  vi.stubEnv("GOOGLE_CLIENT_ID", CLIENT_ID);
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "shh");
};

function request(path: string, init: { method?: string; headers?: Record<string, string>; body?: BodyInit; cookies?: Record<string, string> } = {}) {
  const headers = new Headers({ host: "localhost:3000", ...init.headers });
  if (init.cookies) headers.set("cookie", Object.entries(init.cookies).map(([k, v]) => `${k}=${v}`).join("; "));
  return new NextRequest(new URL(path, ORIGIN), { method: init.method ?? "GET", headers, body: init.body });
}

const form = (fields: Record<string, string>) => ({ "content-type": "application/x-www-form-urlencoded" as const, body: new URLSearchParams(fields).toString() });

/** The Set-Cookie line for one cookie, lower-cased for attribute checks. */
function setCookie(res: Response, name: string): string | undefined {
  return res.headers
    .getSetCookie()
    .find((c) => c.startsWith(`${name}=`))
    ?.toLowerCase();
}
const cookieValue = (res: Response, name: string) => res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`))?.split(";")[0].slice(name.length + 1);

describe("POST /api/auth/demo", () => {
  it("signs a same-origin visitor in and sends them to the sanitised next", async () => {
    const { body, ...type } = form({ next: "/settings?tab=connections" });
    const res = await demo(request("/api/auth/demo", { method: "POST", headers: { origin: ORIGIN, ...type }, body }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/settings?tab=connections`);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const line = setCookie(res, SESSION_COOKIE)!;
    expect(line).toContain("httponly");
    expect(line).toContain("samesite=lax");
    expect(line).toContain("path=/");
    expect(line).toMatch(/max-age=604800/);
    const session = await verifySession(cookieValue(res, SESSION_COOKIE), SECRET);
    expect(session?.demo).toBe(true);
  });

  it("drops a next that would leave the site", async () => {
    for (const next of ["//evil.example", "/.//evil.example", "https://evil.example", "/api/auth/signout"]) {
      const { body, ...type } = form({ next });
      const res = await demo(request("/api/auth/demo", { method: "POST", headers: { origin: ORIGIN, ...type }, body }));
      expect(res.headers.get("location"), next).toBe(`${ORIGIN}/home`);
    }
  });

  it("refuses cross-site and Origin-less posts without setting a cookie", async () => {
    const refused: Record<string, string>[] = [{ origin: "https://evil.example" }, { origin: "null" }, { origin: "http://evil.localhost:3000" }, { "sec-fetch-site": "same-site" }, {}];
    for (const headers of refused) {
      const res = await demo(request("/api/auth/demo", { method: "POST", headers }));
      expect(res.status, JSON.stringify(headers)).toBe(403);
      expect(res.headers.getSetCookie(), JSON.stringify(headers)).toEqual([]);
    }
    // Fetch Metadata stands in when a browser sends no Origin.
    const res = await demo(request("/api/auth/demo", { method: "POST", headers: { "sec-fetch-site": "same-origin" } }));
    expect(res.status).toBe(303);
  });
});

describe("POST /api/auth/signout", () => {
  it("clears the session for a same-origin post and refuses a cross-site one", async () => {
    const ok = await signout(request("/api/auth/signout", { method: "POST", headers: { origin: ORIGIN } }));
    expect(ok.status).toBe(303);
    expect(ok.headers.get("location")).toBe(`${ORIGIN}/`);
    expect(setCookie(ok, SESSION_COOKIE)).toMatch(/max-age=0/);
    const no = await signout(request("/api/auth/signout", { method: "POST", headers: { origin: "https://evil.example" } }));
    expect(no.status).toBe(403);
    expect(no.headers.getSetCookie()).toEqual([]);
  });
});

describe("GET /api/auth/google", () => {
  it("explains when Google is not configured, keeping a safe next", async () => {
    const res = await startGoogle(request("/api/auth/google?next=/settings"));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/?error=google_unavailable&next=%2Fsettings`);
  });

  it("starts the flow: state, nonce and PKCE in the URL, the same values sealed in a scoped cookie", async () => {
    withGoogle();
    const res = await startGoogle(request(`/api/auth/google?next=${encodeURIComponent("/.//evil.example")}`));
    expect(res.status).toBe(302);
    const url = new URL(res.headers.get("location")!);
    expect(url.origin).toBe("https://accounts.google.com");
    const line = setCookie(res, OAUTH_COOKIE)!;
    expect(line).toContain("httponly");
    expect(line).toContain("samesite=lax");
    expect(line).toContain("path=/api/auth/google");
    expect(line).toMatch(/max-age=600/);
    const flow = await openFlow(cookieValue(res, OAUTH_COOKIE), SECRET);
    expect(flow?.state).toBe(url.searchParams.get("state"));
    expect(flow?.nonce).toBe(url.searchParams.get("nonce"));
    expect(flow?.nonce).not.toBe(flow?.state);
    expect(flow?.next).toBe("/home");
  });

  it("starts over on the canonical origin when APP_ORIGIN differs", async () => {
    withGoogle();
    vi.stubEnv("APP_ORIGIN", "https://diablo.example");
    const res = await startGoogle(request("/api/auth/google?next=/settings"));
    expect(res.headers.get("location")).toBe("https://diablo.example/api/auth/google?next=%2Fsettings");
    expect(res.headers.getSetCookie()).toEqual([]);
  });
});

describe("GET /api/auth/google/callback", () => {
  const FLOW: FlowState = { state: "state-abc", verifier: "v".repeat(64), nonce: "nonce-xyz", next: "/investigations/tool-use-reliability" };
  const NOW = () => Math.floor(Date.now() / 1000);

  const googleToken = (claims: Record<string, unknown> = {}, key: CryptoKey = googleKey) =>
    new SignJWT({ iss: "https://accounts.google.com", aud: CLIENT_ID, azp: CLIENT_ID, sub: "42", iat: NOW(), exp: NOW() + 3600, nonce: FLOW.nonce, email: "ada@example.com", email_verified: true, name: "Ada Lovelace", ...claims })
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .sign(key);

  /** Google, as seen through fetch: the token endpoint and the key set. */
  function stubGoogle(idToken: string) {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = input instanceof Request ? input.url : String(input);
        calls.push(url);
        const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
        if (url === GOOGLE_TOKEN_URL) return json({ id_token: idToken, access_token: "x" });
        if (url === GOOGLE_JWKS_URL) return json({ keys: [jwk] });
        throw new Error(`unexpected fetch ${url}`);
      }),
    );
    return calls;
  }

  const callback = async (query: Record<string, string>, flow: FlowState | null = FLOW) =>
    googleCallback(request(`/api/auth/google/callback?${new URLSearchParams(query)}`, { cookies: flow ? { [OAUTH_COOKIE]: await sealFlow(flow, SECRET) } : {} }));

  const flowCleared = (res: Response) => expect(setCookie(res, OAUTH_COOKIE)).toMatch(/max-age=0/);

  it("signs in with a verified token and goes to next, clearing the flow cookie", async () => {
    withGoogle();
    const calls = stubGoogle(await googleToken());
    const res = await callback({ code: "c0de", state: FLOW.state });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(`${ORIGIN}${FLOW.next}`);
    const session = await verifySession(cookieValue(res, SESSION_COOKIE), SECRET);
    expect(session?.user).toMatchObject({ id: "google:42", name: "Ada Lovelace", email: "ada@example.com" });
    expect(session?.demo).toBe(false);
    flowCleared(res);
    expect(calls).toContain(GOOGLE_TOKEN_URL);
    expect(calls).toContain(GOOGLE_JWKS_URL);
  });

  it("refuses a token minted for another flow (nonce mismatch): no session", async () => {
    withGoogle();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    stubGoogle(await googleToken({ nonce: "someone-elses-nonce" }));
    const res = await callback({ code: "c0de", state: FLOW.state });
    expect(res.headers.get("location")).toBe(`${ORIGIN}/?error=exchange_failed&next=${encodeURIComponent(FLOW.next)}`);
    expect(setCookie(res, SESSION_COOKIE)).toBeUndefined();
    flowCleared(res);
    expect(String(log.mock.calls[0]?.[1])).toContain("nonce");
  });

  it("refuses a token with a forged signature: no session", async () => {
    withGoogle();
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubGoogle(await googleToken({}, otherKey));
    const res = await callback({ code: "c0de", state: FLOW.state });
    expect(new URL(res.headers.get("location")!).searchParams.get("error")).toBe("exchange_failed");
    expect(setCookie(res, SESSION_COOKIE)).toBeUndefined();
  });

  it("refuses a wrong or missing state before calling Google", async () => {
    withGoogle();
    const calls = stubGoogle(await googleToken());
    for (const [query, flow] of [
      [{ code: "c0de", state: "other" }, FLOW],
      [{ code: "c0de", state: FLOW.state }, null],
    ] as const) {
      const res = await callback(query, flow);
      expect(new URL(res.headers.get("location")!).searchParams.get("error")).toBe("state_mismatch");
      expect(setCookie(res, SESSION_COOKIE)).toBeUndefined();
      // Not this flow's answer: the visitor's own sign-in in progress is left alone.
      expect(setCookie(res, OAUTH_COOKIE)).toBeUndefined();
    }
    expect(calls).toEqual([]);
  });

  it("ignores a cross-site link to the callback: an ?error= without the flow's state neither cancels nor clears the flow", async () => {
    withGoogle();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const calls = stubGoogle(await googleToken());
    const links: Record<string, string>[] = [{ error: "access_denied" }, { error: "access_denied", state: "other" }, { error: "server_error" }];
    for (const query of links) {
      const res = await callback(query);
      expect(res.headers.get("location"), JSON.stringify(query)).toBe(`${ORIGIN}/?error=state_mismatch&next=${encodeURIComponent(FLOW.next)}`);
      expect(setCookie(res, OAUTH_COOKIE), JSON.stringify(query)).toBeUndefined();
      expect(setCookie(res, SESSION_COOKIE), JSON.stringify(query)).toBeUndefined();
    }
    // Nothing reached Google, and nothing an outsider sends is written to the log.
    expect(calls).toEqual([]);
    expect(log).not.toHaveBeenCalled();

    // The flow still completes when Google's real answer arrives.
    const res = await callback({ code: "c0de", state: FLOW.state });
    expect(res.headers.get("location")).toBe(`${ORIGIN}${FLOW.next}`);
    expect(setCookie(res, SESSION_COOKIE)).toBeDefined();
    flowCleared(res);
  });

  it("passes Google's own refusal on, and never redirects off-site from a tampered next", async () => {
    withGoogle();
    const denied = await callback({ error: "access_denied", state: FLOW.state });
    expect(new URL(denied.headers.get("location")!).searchParams.get("error")).toBe("access_denied");
    flowCleared(denied);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const failed = await callback({ error: "temporarily_unavailable", state: FLOW.state });
    expect(new URL(failed.headers.get("location")!).searchParams.get("error")).toBe("server_error");
    flowCleared(failed);

    // A flow cookie can only hold what we sealed, but the callback re-checks next anyway.
    stubGoogle(await googleToken());
    const res = await callback({ code: "c0de", state: FLOW.state }, { ...FLOW, next: "/.//evil.example" });
    expect(res.headers.get("location")).toBe(`${ORIGIN}/home`);
  });
});

describe("Google routes never answer 500", () => {
  // In production a missing AUTH_SECRET throws; before the fail-safe that became a 500 page.
  const brokenProduction = () => {
    withGoogle();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
  };

  it("start: an internal failure sends the visitor back to sign-in with server_error", async () => {
    brokenProduction();
    const res = await startGoogle(request("/api/auth/google?next=/home"));
    expect(res.status).toBe(302);
    expect(new URL(res.headers.get("location")!).search).toBe("?error=server_error");
  });

  it("callback: an internal failure sends the visitor back to sign-in with server_error", async () => {
    brokenProduction();
    const res = await googleCallback(request("/api/auth/google/callback?code=abc&state=xyz", { cookies: { [OAUTH_COOKIE]: "not-a-sealed-flow" } }));
    expect(res.status).toBe(302);
    expect(new URL(res.headers.get("location")!).search).toBe("?error=server_error");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
