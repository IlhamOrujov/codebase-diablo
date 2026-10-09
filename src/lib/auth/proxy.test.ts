import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { SESSION_COOKIE, signSession } from "./session";

/** src/proxy.ts, called directly: authentication, CSRF for app APIs, and sign-in redirects. */
const SECRET = "proxy-test-secret-0123456789-abcdefghijklmnop";
const ORIGIN = "http://localhost:3000";

beforeEach(() => vi.stubEnv("AUTH_SECRET", SECRET));
afterEach(() => vi.unstubAllEnvs());

const demoSession = () => signSession({ id: "demo", name: "Demo researcher", email: null, provider: "demo" }, SECRET);

function request(path: string, init: { method?: string; headers?: Record<string, string>; cookie?: string } = {}) {
  const headers = new Headers({ host: "localhost:3000", ...init.headers });
  if (init.cookie !== undefined) headers.set("cookie", `${SESSION_COOKIE}=${init.cookie}`);
  return new NextRequest(new URL(path, ORIGIN), { method: init.method ?? "GET", headers });
}

const passesThrough = (res: Response) => res.headers.get("x-middleware-next") === "1";
const deletesCookie = (res: Response) => res.headers.getSetCookie().some((c) => c.startsWith(`${SESSION_COOKIE}=;`) && /expires=thu, 01 jan 1970/i.test(c));

describe("sign-in page", () => {
  it("shows sign-in to a visitor without a session", async () => {
    const res = await proxy(request("/?next=/settings"));
    expect(passesThrough(res)).toBe(true);
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it("deletes a cookie that fails verification", async () => {
    const res = await proxy(request("/", { cookie: "forged.token.value" }));
    expect(passesThrough(res)).toBe(true);
    expect(deletesCookie(res)).toBe(true);
  });

  it("sends a signed-in visitor on to a safe next, or home", async () => {
    const cookie = await demoSession();
    const to = async (path: string) => (await proxy(request(path, { cookie }))).headers.get("location");
    expect(await to("/")).toBe(`${ORIGIN}/home`);
    expect(await to("/?next=%2Fsettings%3Ftab%3Dconnections")).toBe(`${ORIGIN}/settings?tab=connections`);
    for (const evil of ["//evil.example", "/.//evil.example", "https://evil.example", "/api/auth/signout"]) {
      expect(await to(`/?next=${encodeURIComponent(evil)}`), evil).toBe(`${ORIGIN}/home`);
    }
  });
});

describe("workspace routes", () => {
  it("send a visitor without a session to sign-in, remembering the path", async () => {
    const res = await proxy(request("/investigations/tool-use-reliability?tab=report", { cookie: "expired-or-forged" }));
    expect(res.status).toBe(307);
    const login = new URL(res.headers.get("location")!);
    expect(login.pathname).toBe("/");
    expect(login.searchParams.get("next")).toBe("/investigations/tool-use-reliability?tab=report");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(deletesCookie(res)).toBe(true);
  });

  it("let a signed-in visitor through", async () => {
    expect(passesThrough(await proxy(request("/home", { cookie: await demoSession() })))).toBe(true);
  });
});

describe("app API routes", () => {
  it("answer 401 without a session, dropping a bad cookie", async () => {
    const res = await proxy(request("/api/live/run", { cookie: "nope" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthenticated" });
    expect(deletesCookie(res)).toBe(true);
  });

  it("refuse a state-changing request from another origin, even with a valid session", async () => {
    const cookie = await demoSession();
    const refused: Record<string, string>[] = [
      { origin: "https://evil.example" },
      // Same site, other origin: SameSite=Lax would still send the cookie.
      { origin: "http://evil.localhost:3000" },
      { origin: "null" },
      { "sec-fetch-site": "same-site" },
      {},
    ];
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      for (const headers of refused) {
        const res = await proxy(request("/api/live/run", { method, headers, cookie }));
        expect(res.status, `${method} ${JSON.stringify(headers)}`).toBe(403);
      }
    }
  });

  it("let same-origin writes and any reads through", async () => {
    const cookie = await demoSession();
    expect(passesThrough(await proxy(request("/api/live/run", { method: "POST", headers: { origin: ORIGIN }, cookie })))).toBe(true);
    expect(passesThrough(await proxy(request("/api/live/run", { method: "POST", headers: { "sec-fetch-site": "same-origin" }, cookie })))).toBe(true);
    expect(passesThrough(await proxy(request("/api/live/status", { headers: { origin: "https://evil.example" }, cookie })))).toBe(true);
  });
});
