import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SessionProvider } from "@/components/auth/SessionProvider";
import { AppShell } from "@/components/shell/AppShell";
import { getSession } from "@/lib/auth/dal";
import type { Session } from "@/lib/auth/types";

export default function AppLayout({ children }: LayoutProps<"/">) {
  // Started here, not awaited: the shell stays in the static prerender and
  // only the parts that show the user wait for the request.
  const session = getSession();
  return (
    <SessionProvider session={session}>
      <AppShell>{children}</AppShell>
      <Suspense fallback={null}>
        <RequireSession session={session} />
      </Suspense>
    </SessionProvider>
  );
}

/** Defence in depth behind the proxy: no verified session, no workspace. */
async function RequireSession({ session }: { session: Promise<Session | null> }) {
  if (!(await session)) redirect("/");
  return null;
}
