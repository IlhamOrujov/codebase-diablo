import type { Metadata } from "next";
import { SignIn } from "@/components/brand/SignIn";
import { isGoogleConfigured } from "@/lib/auth/env";
import { safeNext } from "@/lib/auth/next-path";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: { absolute: `Sign in · ${BRAND.name}` } };

/**
 * Rendered per request, blocking on the query rather than streaming into a
 * static shell. Both ways in work without JavaScript, so the demo form's
 * hidden `next` field and any `?error=` message must be in the HTML itself:
 * streamed content is only swapped in by script. The page has no data to
 * wait for, and signed-in visitors never see it (the proxy sends them on).
 */
export const instant = false;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

export default async function Page({ searchParams }: PageProps<"/">) {
  const query = await searchParams;
  return (
    <SignIn
      googleEnabled={isGoogleConfigured()}
      // Sanitised here and again by every route that redirects to it.
      next={safeNext(first(query.next), "")}
      error={first(query.error)}
    />
  );
}
