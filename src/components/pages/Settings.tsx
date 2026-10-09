"use client";

import Link from "next/link";
import { useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { downloadText } from "@/components/charts/ChartFrame";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Segmented } from "@/components/ui/Segmented";
import { BRAND } from "@/lib/brand";
import { provider } from "@/lib/data";
import { setMotionPref, setThemePref, useMotionPref, useThemePref, type MotionPref, type ThemePref } from "@/lib/prefs";
import { toast } from "@/lib/ui";
import { LEGAL } from "@/components/shell/nav";
import { Page, PageHeader } from "./Library";

function Row({ title, sub, children, id }: { title: string; sub: string; children?: React.ReactNode; id?: string }) {
  return (
    <div id={id} className="flex flex-col gap-3 border-b border-line py-5 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="font-medium text-ink">{title}</div>
        <p className="mt-0.5 text-[13px] text-ink-2">{sub}</p>
      </div>
      {children && <div className="flex shrink-0 flex-wrap gap-2">{children}</div>}
    </div>
  );
}

const CONNECTIONS = [
  { name: "Model providers", sub: "Send prompts to the AI systems you investigate." },
  { name: "Tracing", sub: "Import agent traces for the trace viewer." },
  { name: "Datasets", sub: "Load item sets from your own storage." },
  { name: "Human labels", sub: "Bring judge–human agreement checks (C5)." },
];

export function SettingsPage() {
  const theme = useThemePref();
  const motion = useMotionPref();
  const [confirm, setConfirm] = useState(false);
  return (
    <Page>
      <PageHeader title="Settings" sub="Preferences are saved in this browser. Nothing here leaves your device." />

      <section aria-labelledby="s-appearance" className="mt-8">
        <h2 id="s-appearance" className="text-[14px] font-medium text-ink-2">
          Appearance
        </h2>
        <Row title="Theme" sub="System follows your device's light or dark setting.">
          <Segmented<ThemePref>
            label="Theme"
            value={theme}
            onChange={setThemePref}
            items={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
              { value: "system", label: "System" },
            ]}
          />
        </Row>
        <Row title="Motion" sub="Reduce turns off the logo reveal, the running pulse and every transition, whatever your device says.">
          <Segmented<MotionPref>
            label="Motion"
            value={motion}
            onChange={setMotionPref}
            items={[
              { value: "system", label: "System" },
              { value: "reduce", label: "Reduce" },
            ]}
          />
        </Row>
      </section>

      <section aria-labelledby="s-data" className="mt-8">
        <h2 id="s-data" className="text-[14px] font-medium text-ink-2">
          Data
        </h2>
        <Row title="Export all as JSON" sub="Every investigation, experiment, run and sample in this tab.">
          <Button
            icon={<Download strokeWidth={1.5} />}
            onClick={() => {
              downloadText(`workspace-${new Date().toISOString().slice(0, 10)}.json`, provider.exportAll(), "application/json");
              toast({ title: "Export ready", body: "JSON downloaded" });
            }}
          >
            Export
          </Button>
        </Row>
        <Row title="Clear local data" sub="Removes your investigations and restores the demo ones. Preferences stay.">
          <Button icon={<Trash2 strokeWidth={1.5} />} onClick={() => setConfirm(true)}>
            Clear
          </Button>
        </Row>
      </section>

      <section aria-labelledby="s-connections" id="connections" className="mt-8 scroll-mt-8">
        <h2 id="s-connections" className="text-[14px] font-medium text-ink-2">
          Connections
        </h2>
        {CONNECTIONS.map((c) => (
          <Row key={c.name} title={c.name} sub={c.sub}>
            <span className="text-[13px] text-ink-3">Not connected in the demo</span>
          </Row>
        ))}
      </section>

      <section aria-labelledby="s-about" className="mt-8">
        <h2 id="s-about" className="text-[14px] font-medium text-ink-2">
          About
        </h2>
        <Row title={BRAND.name} sub={`Version ${BRAND.version} · build ${process.env.NEXT_PUBLIC_BUILD_ID ?? "local"} · ${provider.label}`} />
        <div className="flex flex-wrap gap-x-4 gap-y-1 py-4 text-[13px]">
          {LEGAL.map((l) => (
            <Link key={l.href} href={l.href} className="text-ink-2 underline underline-offset-2 hover:text-ink">
              {l.label}
            </Link>
          ))}
        </div>
      </section>

      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Clear local data?"
        description="Your investigations in this tab will be deleted and the demo investigations restored. This cannot be undone."
      >
        <div className="flex justify-end gap-2 p-5">
          <Button variant="ghost" onClick={() => setConfirm(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              provider.resetAll();
              setConfirm(false);
              toast({ title: "Local data cleared", body: "Demo investigations restored" });
            }}
          >
            Clear data
          </Button>
        </div>
      </Dialog>
    </Page>
  );
}
