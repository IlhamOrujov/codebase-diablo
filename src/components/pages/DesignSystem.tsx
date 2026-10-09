"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { Composer } from "@/components/home/Composer";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { StatusLabel } from "@/components/ui/Status";
import { TabPanel, Tabs } from "@/components/ui/Tabs";
import { Interpretation, Kbd, Progress } from "@/components/ui/primitives";
import { VerdictTag, CheckSymbol } from "@/components/research/common";
import { Page, PageHeader } from "./Library";

const TOKENS = ["bg", "surface", "subtle", "sunken", "line", "line-strong", "line-field", "ink", "ink-2", "ink-3", "accent", "accent-text", "ok", "warn", "bad"];

/** Living reference for the redesigned components (development builds only). */
export function DesignSystem() {
  const [tab, setTab] = useState<"a" | "b">("a");
  const [seg, setSeg] = useState<"one" | "two">("one");
  return (
    <Page>
      <PageHeader title="Design system" sub="Tokens and components. Development builds only." />
      <h2 className="mt-8 font-medium">Tokens</h2>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
        {TOKENS.map((t) => (
          <div key={t} className="rounded-[10px] border border-line p-2 text-[12px]">
            <div className="h-10 rounded-[6px] border border-line" style={{ background: `var(--${t === "subtle" || t === "sunken" ? `surface-${t}` : t})` }} />
            <div className="mt-1 font-mono text-ink-2">{t}</div>
          </div>
        ))}
      </div>
      <h2 className="mt-8 font-medium">Type</h2>
      <p className="mt-2 text-[32px] font-semibold leading-[40px] tracking-[-0.022em]">What do you want to find out?</p>
      <p className="mt-1 text-[14px]">Geist 14/20 for the interface. Weights 400 and 500.</p>
      <p className="font-mono text-[13px] tabular">Δ +8.5 pp [95% CI 1.6, 15.3] · p = 0.016</p>
      <Interpretation className="mt-3">Interpretation text is Newsreader, after a quiet label.</Interpretation>
      <h2 className="mt-8 font-medium">Controls</h2>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="primary">Primary</Button>
        <Button>Secondary</Button>
        <Button variant="ghost" icon={<Play strokeWidth={1.5} />}>
          Ghost
        </Button>
        <Button disabledReason="Explains why it is disabled">Disabled</Button>
        <Kbd>Ctrl</Kbd>
        <Kbd>K</Kbd>
      </div>
      <div className="mt-4 flex flex-wrap gap-4">
        <StatusLabel status="running" />
        <StatusLabel status="complete" />
        <StatusLabel status="needs-review" />
        <StatusLabel status="draft" />
        <StatusLabel status="failed" />
        <VerdictTag verdict="supported" />
        <VerdictTag verdict="partly-supported" />
        <VerdictTag verdict="rejected" />
        <VerdictTag verdict="untested" />
        <span className="flex gap-1">
          <CheckSymbol state="pass" />
          <CheckSymbol state="warn" />
          <CheckSymbol state="fail" />
          <CheckSymbol state="unknown" />
        </span>
      </div>
      <div className="mt-4 max-w-[360px]">
        <Progress value={0.62} label="Example progress" />
      </div>
      <div className="mt-6">
        <Segmented label="Example" value={seg} onChange={setSeg} items={[{ value: "one", label: "One" }, { value: "two", label: "Two" }]} />
      </div>
      <div className="mt-6">
        <Tabs idBase="ds" label="Example tabs" value={tab} onChange={setTab} items={[{ value: "a", label: "First" }, { value: "b", label: "Second" }]} />
        <TabPanel idBase="ds" value={tab} className="pt-3">
          Panel {tab}
        </TabPanel>
      </div>
      <div className="mt-6 max-w-[720px]">
        <Composer id="ds-composer" label="Example composer" placeholder="Describe what you want to find out about an AI system…" onSubmit={() => {}} />
      </div>
    </Page>
  );
}
