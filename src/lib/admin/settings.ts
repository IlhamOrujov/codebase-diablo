import "server-only";
import { get, put } from "@vercel/blob";

/**
 * System-wide settings, shared by every user and every server instance.
 * One small private JSON file in the "diablo-settings" Blob store. Changed
 * only from /admin.
 */
export type Reasoner = "claude" | "gemini";
export interface SystemSettings {
  reasoner: Reasoner;
  updatedAt: string | null;
}

const PATH = "settings/system.json";
const DEFAULTS: SystemSettings = { reasoner: "claude", updatedAt: null };
const TTL_MS = 5_000;
let cache: { at: number; value: SystemSettings } | null = null;

const configured = () => !!process.env.BLOB_READ_WRITE_TOKEN?.trim();

function parse(value: unknown): SystemSettings {
  const v = (value ?? {}) as Partial<SystemSettings>;
  return {
    reasoner: v.reasoner === "gemini" ? "gemini" : "claude",
    updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : null,
  };
}

/** The current settings. Falls back to the defaults (Claude) when the store is missing or unreadable. */
export async function getSystemSettings(): Promise<SystemSettings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  let value = DEFAULTS;
  if (configured()) {
    try {
      const res = await get(PATH, { access: "private", useCache: false });
      if (res) value = parse(JSON.parse(await new Response(res.stream).text()));
    } catch (e) {
      console.error("[admin] could not read system settings:", e instanceof Error ? e.message : "unknown error");
    }
  }
  cache = { at: Date.now(), value };
  return value;
}

export async function setSystemSettings(patch: Partial<Pick<SystemSettings, "reasoner">>): Promise<SystemSettings> {
  if (!configured()) throw new Error("The settings store is not configured (BLOB_READ_WRITE_TOKEN).");
  const next = parse({ ...(await getSystemSettings()), ...patch, updatedAt: new Date().toISOString() });
  await put(PATH, JSON.stringify(next), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  });
  cache = { at: Date.now(), value: next };
  return next;
}
