import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("production is Google sign-in only", () => {
  it("refuses demo sign-in and voids demo sessions when demo mode is off", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "");
    vi.stubEnv("AUTH_SECRET", "demo-mode-test-secret-0123456789-abcdefghij");
    vi.resetModules();
    const { POST } = await import("@/app/api/auth/demo/route");
    const { NextRequest } = await import("next/server");
    const res = await POST(new NextRequest("http://localhost:3000/api/auth/demo", { method: "POST", headers: { origin: "http://localhost:3000", host: "localhost:3000" } }));
    expect(res.status).toBe(404);

    const { signSession, verifySession } = await import("@/lib/auth/session");
    const secret = "demo-mode-test-secret-0123456789-abcdefghij";
    const demo = await signSession({ id: "demo", name: "Demo researcher", email: null, provider: "demo" }, secret);
    expect(await verifySession(demo, secret)).toBeNull();
    const google = await signSession({ id: "42", name: "Ada", email: "ada@example.com", provider: "google" }, secret);
    expect((await verifySession(google, secret))?.provider).toBe("google");
  });
});
