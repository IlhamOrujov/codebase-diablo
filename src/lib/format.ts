/**
 * Time and number formatting with fixed locales, so the server and the
 * client always print the same thing (no hydration mismatch).
 */

const rtf = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
const nf = new Intl.NumberFormat("en-US");
const abs = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
  timeZoneName: "short",
});
const day = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

/** "8 minutes ago", "3 hours ago", "yesterday", "2 days ago", "just now". */
export function relativeTime(iso: string, now: number): string {
  const diff = Date.parse(iso) - now; // negative in the past
  const s = Math.round(diff / 1000);
  const a = Math.abs(s);
  if (a < 45) return "just now";
  if (a < 45 * 60) return rtf.format(Math.round(s / 60), "minute");
  if (a < 22 * 3600) return rtf.format(Math.round(s / 3600), "hour");
  if (a < 26 * 86400) return rtf.format(Math.round(s / 86400), "day");
  if (a < 320 * 86400) return rtf.format(Math.round(s / (30 * 86400)), "month");
  return rtf.format(Math.round(s / (365 * 86400)), "year");
}

/** "Oct 7, 2026, 14:05 UTC" for tooltips. */
export function absoluteTime(iso: string): string {
  return abs.format(new Date(iso));
}

/** "October 7, 2026" */
export function longDate(iso: string): string {
  return day.format(new Date(iso));
}

/** "1,400" */
export function count(n: number): string {
  return nf.format(n);
}

/** "1.2 s", "45 min", "320 ms" */
export function duration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} min`;
  return `${(ms / 3_600_000).toFixed(1)} h`;
}

export type RecencyGroup = "Today" | "Yesterday" | "Previous 7 days" | "Older";

/** Sidebar groups, by local calendar day. */
export function recencyGroup(iso: string, now: number): RecencyGroup {
  const d = new Date(iso);
  const n = new Date(now);
  const startOfToday = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  const t = d.getTime();
  if (t >= startOfToday) return "Today";
  if (t >= startOfToday - 86400_000) return "Yesterday";
  if (t >= startOfToday - 7 * 86400_000) return "Previous 7 days";
  return "Older";
}
