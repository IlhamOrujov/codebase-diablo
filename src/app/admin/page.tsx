import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { ReasonerSwitch } from "@/components/admin/ReasonerSwitch";
import { AdminSignOut } from "@/components/admin/AdminSignOut";
import { Page, PageHeader } from "@/components/pages/Library";
import { ADMIN_COOKIE, isAdminToken } from "@/lib/admin/auth";
import { getSystemSettings } from "@/lib/admin/settings";
import { googleConfig } from "@/lib/auth/env";
import { configForReasoner } from "@/lib/live/team";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default function AdminPage() {
  return (
    <Page>
      <Suspense fallback={<div className="mt-8 h-40 rounded-[10px] bg-sunken" aria-busy="true" />}>
        <Gate />
      </Suspense>
    </Page>
  );
}

async function Gate() {
  await connection();
  const ok = await isAdminToken((await cookies()).get(ADMIN_COOKIE)?.value);
  if (!ok) return <AdminLogin configured={!!process.env.ADMIN_PASSWORD?.trim()} />;
  return <Dashboard />;
}

const yes = (v: boolean) => (v ? "Set" : "Missing");

async function Dashboard() {
  const settings = await getSystemSettings();
  const active = configForReasoner(settings.reasoner);
  const env = process.env;
  const has = (k: string) => !!env[k]?.trim();

  const status: [string, string, boolean][] = [
    ["Investigator model", `${active.reasoner === "gemini" ? "Google Gemini" : "Claude"} · ${active.reasoningModel}`, true],
    ["System under test (testbed)", active.targetModel, true],
    ["ANTHROPIC_API_KEY", yes(has("ANTHROPIC_API_KEY")), has("ANTHROPIC_API_KEY")],
    ["GEMINI_API_KEY", yes(has("GEMINI_API_KEY")), has("GEMINI_API_KEY")],
    ["Google sign-in", googleConfig() ? "Configured" : "Not configured", !!googleConfig()],
    ["AUTH_SECRET", yes(has("AUTH_SECRET")), has("AUTH_SECRET")],
    ["Settings store (Blob)", yes(has("BLOB_READ_WRITE_TOKEN")), has("BLOB_READ_WRITE_TOKEN")],
    ["App origin", env.APP_ORIGIN?.trim() || "From the request", true],
    ["Environment", env.VERCEL_ENV ?? "local", true],
    ["Deployment", (env.VERCEL_GIT_COMMIT_SHA ?? env.NEXT_PUBLIC_BUILD_ID ?? "local").slice(0, 7), true],
    ["Region", env.VERCEL_REGION ?? "local", true],
  ];
  const limits: [string, string][] = [
    ["Experiments per run", String(active.caps.maxExperiments)],
    ["Items per arm", `${active.caps.minItemsPerArm}–${active.caps.maxItemsPerArm}`],
    ["Concurrent target calls", String(active.caps.concurrency)],
    ["Target call timeout", `${Math.round(active.caps.targetTimeoutMs / 1000)} s`],
    ["Reasoning call timeout", `${Math.round(active.caps.reasoningTimeoutMs / 1000)} s`],
    ["Daily call cap (per instance)", String(active.limits.dailyCallCap)],
    ["Cooldown between runs", `${Math.round(active.limits.cooldownMs / 1000)} s`],
    ["Concurrent runs (per instance)", String(active.limits.maxConcurrentRuns)],
  ];
  const links: [string, string][] = [
    ["Vercel project (app)", "https://vercel.com/ilham-orucovs-projects/diablo"],
    ["Vercel project (website)", "https://vercel.com/ilham-orucovs-projects/diablo-site"],
    ["Environment variables", "https://vercel.com/ilham-orucovs-projects/diablo/settings/environment-variables"],
    ["GitHub repository", "https://github.com/wcissor/diablo"],
    ["Anthropic console", "https://platform.claude.com"],
    ["Google AI Studio", "https://aistudio.google.com/apikey"],
    ["Google Cloud OAuth client", "https://console.cloud.google.com/apis/credentials"],
  ];

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Admin" sub="System settings for everyone using Diablo. Changes apply to the next live run." />
        <AdminSignOut />
      </div>

      <section aria-labelledby="a-model" className="mt-8 rounded-[10px] border border-line bg-surface p-5">
        <h2 id="a-model" className="text-[15px] font-medium text-ink">
          Google Gemini
        </h2>
        <p className="mt-1 text-[13px] text-ink-2">
          Off: every live investigation uses Claude Opus 5.5. On: every live investigation uses Google Gemini instead.
        </p>
        <div className="mt-4">
          <ReasonerSwitch initial={settings.reasoner} geminiAvailable={has("GEMINI_API_KEY")} updatedAt={settings.updatedAt} />
        </div>
      </section>

      <section aria-labelledby="a-status" className="mt-8">
        <h2 id="a-status" className="text-[14px] font-medium text-ink-2">
          System status
        </h2>
        <dl className="mt-2 divide-y divide-line rounded-[10px] border border-line bg-surface">
          {status.map(([k, v, good]) => (
            <div key={k} className="flex items-center justify-between gap-4 px-4 py-2.5 text-[14px]">
              <dt className="text-ink-2">{k}</dt>
              <dd className={good ? "font-mono text-[13px] text-ink" : "font-mono text-[13px] text-bad"}>{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="a-limits" className="mt-8">
        <h2 id="a-limits" className="text-[14px] font-medium text-ink-2">
          Live run limits
        </h2>
        <dl className="mt-2 divide-y divide-line rounded-[10px] border border-line bg-surface">
          {limits.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-4 px-4 py-2.5 text-[14px]">
              <dt className="text-ink-2">{k}</dt>
              <dd className="font-mono text-[13px] text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-[12px] text-ink-3">Change limits with the LIVE_* environment variables on Vercel, then redeploy.</p>
      </section>

      <section aria-labelledby="a-links" className="mt-8 pb-12">
        <h2 id="a-links" className="text-[14px] font-medium text-ink-2">
          Consoles
        </h2>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {links.map(([label, href]) => (
            <li key={href}>
              <a href={href} target="_blank" rel="noreferrer" className="block rounded-[10px] border border-line bg-surface px-4 py-3 text-[14px] text-ink hover:bg-sunken">
                {label} ↗
              </a>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
