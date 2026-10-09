import { describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { SESSION_TTL_SECONDS, signSession, verifySession } from "./session";
import { initialsOf } from "./types";

const SECRET = "test-secret-0123456789-abcdefghijklmnopqrstuvwxyz";
const NOW = 1_800_000_000;
const ada = { id: "google:42", name: "Ada Lovelace", email: "ada@example.com", provider: "google" as const };

describe("session cookie", () => {
  it("round-trips a signed session", async () => {
    const token = await signSession(ada, SECRET, NOW);
    const s = await verifySession(token, SECRET, NOW + 60);
    expect(s).toEqual({
      user: { id: "google:42", name: "Ada Lovelace", initials: "AL", email: "ada@example.com" },
      workspace: "Personal workspace",
      provider: "google",
      demo: false,
      expiresAt: NOW + SESSION_TTL_SECONDS,
    });
  });

  it("marks demo sessions", async () => {
    const token = await signSession({ id: "demo", name: "Demo researcher", email: null, provider: "demo" }, SECRET, NOW);
    const s = await verifySession(token, SECRET, NOW);
    expect(s?.demo).toBe(true);
    expect(s?.user.initials).toBe("DR");
    expect(s?.workspace).toBe("Demo workspace");
  });

  it("expires after seven days", async () => {
    const token = await signSession(ada, SECRET, NOW);
    expect(await verifySession(token, SECRET, NOW + SESSION_TTL_SECONDS - 1)).not.toBeNull();
    expect(await verifySession(token, SECRET, NOW + SESSION_TTL_SECONDS + 1)).toBeNull();
  });

  it("rejects a token signed with another secret", async () => {
    const token = await signSession(ada, "another-secret-0123456789-abcdefghijklmnop", NOW);
    expect(await verifySession(token, SECRET, NOW)).toBeNull();
  });

  it("rejects a tampered payload", async () => {
    const token = await signSession({ ...ada, provider: "demo" }, SECRET, NOW);
    const [h, p, sig] = token.split(".");
    const claims = JSON.parse(Buffer.from(p, "base64url").toString());
    claims.name = "Mallory";
    const forged = [h, Buffer.from(JSON.stringify(claims)).toString("base64url"), sig].join(".");
    expect(await verifySession(forged, SECRET, NOW)).toBeNull();
  });

  it("rejects alg=none, garbage, empty and missing tokens", async () => {
    const none = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from('{"sub":"x","provider":"demo"}').toString("base64url")}.`;
    for (const t of [none, "garbage", "a.b.c", "", undefined, null]) {
      expect(await verifySession(t, SECRET, NOW)).toBeNull();
    }
  });

  it("rejects a valid signature with the wrong audience or an unknown provider", async () => {
    const key = new TextEncoder().encode(SECRET);
    const wrongAud = await new SignJWT({ provider: "demo", name: "X" }).setProtectedHeader({ alg: "HS256" }).setSubject("x").setIssuer("diablo").setAudience("elsewhere").setExpirationTime(NOW + 60).sign(key);
    const badProvider = await new SignJWT({ provider: "github", name: "X" }).setProtectedHeader({ alg: "HS256" }).setSubject("x").setIssuer("diablo").setAudience("diablo-app").setExpirationTime(NOW + 60).sign(key);
    expect(await verifySession(wrongAud, SECRET, NOW)).toBeNull();
    expect(await verifySession(badProvider, SECRET, NOW)).toBeNull();
  });
});

describe("initialsOf", () => {
  it("takes first and last initials", () => {
    expect(initialsOf("Ada Lovelace")).toBe("AL");
    expect(initialsOf("  plato ")).toBe("P");
    expect(initialsOf("Jean Claude Van Damme")).toBe("JD");
    expect(initialsOf("")).toBe("?");
  });
});
