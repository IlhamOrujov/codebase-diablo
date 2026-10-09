"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ChevronRight, Download, FileJson, FileText, PanelRight, Play, Printer, X } from "lucide-react";
import { downloadText } from "@/components/charts/ChartFrame";
import { Button, IconButton } from "@/components/ui/Button";
import { Dialog, DialogClose } from "@/components/ui/Dialog";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/Menu";
import { StatusLabel } from "@/components/ui/Status";
import { TabPanel, Tabs } from "@/components/ui/Tabs";
import { Skeleton, Time } from "@/components/ui/primitives";
import { BRAND } from "@/lib/brand";
import { familyOf, provider, systemName, useInvestigation, useNow } from "@/lib/data";
import { investigationStatus, totalSamples } from "@/lib/data/derive";
import { count } from "@/lib/format";
import { assess } from "@/lib/validity";
import { useMediaQuery } from "./common";
import { Ctx, TABS, useWS, type Tab, type WorkspaceCtx } from "./context";
import { EvidenceBrowser } from "./EvidenceBrowser";
import { ExperimentDetail } from "./ExperimentDetail";
import { GraphTab } from "./GraphTab";
import { OverviewTab } from "./OverviewTab";
import { ReportTab } from "./ReportTab";
import { reportJSON, reportMarkdown } from "./report-export";
import { SessionTab } from "./SessionTab";
import { TraceViewer } from "./TraceViewer";

const TAB_LABEL: Record<Tab, string> = { session: "Session", overview: "Overview", graph: "Graph", evidence: "Evidence", report: "Report" };
const RESUME_KEY = "diablo.resume";

type Resume = Record<string, { tab: Tab; exp: string | null }>;
function readResume(): Resume {
  try {
    const v = JSON.parse(localStorage.getItem(RESUME_KEY) ?? "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}
function writeResume(id: string, tab: Tab, exp: string | null) {
  try {
    const all = readResume();
    all[id] = { tab, exp };
    localStorage.setItem(RESUME_KEY, JSON.stringify(all));
  } catch {}
}

export function Workspace({ id }: { id: string }) {
  const { ready, inv } = useInvestigation(id);
  if (!ready) return <WorkspaceSkeleton />;
  if (!inv) {
    return (
      <div className="mx-auto max-w-[560px] px-4 py-24">
        <meta name="robots" content="noindex" />
        <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.02em] text-ink">This investigation isn&apos;t in this browser</h1>
        <p className="mt-3 text-ink-2">
          Investigations in the demo live in this tab&apos;s storage. It may have been deleted, or created in another tab or browser.
        </p>
        <Link href="/investigations" className="mt-6 inline-block text-accent-text underline underline-offset-2">
          See all investigations
        </Link>
      </div>
    );
  }
  return <Loaded key={inv.id} id={inv.id} />;
}

function Loaded({ id }: { id: string }) {
  const { inv } = useInvestigation(id);
  const params = useSearchParams();
  const wide = useMediaQuery("(min-width: 1280px)", true);
  const status = investigationStatus(inv!);
  const now = useNow(60_000);

  // URL state is untrusted: check ?tab= and ?exp= against a whitelist and fall back silently.
  const urlTab = params.get("tab");
  const urlExp = params.get("exp");
  const validTab = (t: string | null): t is Tab => !!t && (TABS as string[]).includes(t);
  const validExp = (e: string | null | undefined) => (e && inv!.experiments.some((x) => x.id === e) ? e : null);
  const defaultTab: Tab = "overview";

  const [state, setState] = useState<{ tab: Tab; exp: string | null }>(() => {
    const saved = readResume()[id];
    return {
      tab: validTab(urlTab) ? urlTab : saved && validTab(saved.tab) ? saved.tab : defaultTab,
      exp: validExp(urlExp) ?? (urlTab || urlExp ? null : validExp(saved?.exp)),
    };
  });
  const [panelOpen, setPanelOpen] = useState(state.exp !== null);
  const [trace, setTrace] = useState<string | null>(null);
  const [evidenceFor, setEvidenceFor] = useState<string | null>(null);

  // Mirror tab and panel into the URL (shareable) and remember them per investigation ("continue where you left").
  useEffect(() => {
    const u = new URL(window.location.href);
    u.searchParams.set("tab", state.tab);
    if (state.exp && panelOpen) u.searchParams.set("exp", state.exp);
    else u.searchParams.delete("exp");
    if (u.href !== window.location.href) window.history.replaceState(window.history.state, "", u);
    writeResume(id, state.tab, panelOpen ? state.exp : null);
  }, [state, panelOpen, id]);

  useEffect(() => {
    if (inv) document.title = `${inv.title} · ${BRAND.name}`;
  }, [inv]);

  // Side panel (1280px and wider): focus moves into it on open, Esc closes it, focus returns.
  const sideOpen = panelOpen && wide;
  const asideRef = useRef<HTMLElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!sideOpen) return;
    returnTo.current = document.activeElement as HTMLElement | null;
    asideRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || document.querySelector("[role=dialog],[role=menu]")) return;
      setPanelOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      returnTo.current?.focus?.({ preventScroll: true });
    };
  }, [sideOpen, state.exp]);

  if (!inv) return null;
  const assessment = assess(inv, familyOf);
  const exp = state.exp ? inv.experiments.find((e) => e.id === state.exp) : undefined;
  const proposed = inv.experiments.filter((e) => e.status === "proposed").length;
  const n = totalSamples(inv);

  const ctx: WorkspaceCtx = {
    inv,
    assessment,
    tab: state.tab,
    setTab: (tab) => setState((s) => ({ ...s, tab })),
    openRef: (ref) => {
      const target = ref.startsWith("H") ? inv.experiments.find((e) => e.hypothesisId === ref)?.id : ref;
      if (!target || !inv.experiments.some((e) => e.id === target)) return;
      setState((s) => ({ ...s, exp: target }));
      setPanelOpen(true);
    },
    openTrace: setTrace,
    selectedExp: panelOpen ? state.exp : null,
    evidenceFor,
    showEvidence: (expId) => {
      setEvidenceFor(expId);
      setState((s) => ({ ...s, tab: "evidence" }));
      if (!wide) setPanelOpen(false);
    },
  };

  const exportMd = () =>
    downloadText(
      `${inv.id}.md`,
      reportMarkdown(inv, assessment, systemName, (d) => (d ? (provider.getDataset(d)?.name ?? d) : null)),
      "text/markdown",
    );
  const exportJson = () => downloadText(`${inv.id}.json`, reportJSON(inv, assessment), "application/json");
  const print = () => {
    setState((s) => ({ ...s, tab: "report" }));
    setTimeout(() => window.print(), 50);
  };

  const showSide = panelOpen && wide;

  return (
    <Ctx.Provider value={ctx}>
      <div className={showSide ? "grid min-h-full grid-cols-[minmax(0,1fr)_440px]" : ""}>
        <div className="min-w-0 px-4 pb-16 pt-3 sm:px-6 lg:px-8">
          {/* Top row: breadcrumb (desktop), status, actions */}
          <div className="no-print flex min-h-12 items-center gap-2">
            <nav aria-label="Breadcrumb" className="hidden min-w-0 flex-1 items-center gap-1 text-[13px] md:flex">
              <Link href="/investigations" className="shrink-0 text-ink-2 hover:text-ink">
                Investigations
              </Link>
              <ChevronRight className="size-4 shrink-0 text-ink-3" strokeWidth={1.5} aria-hidden />
              <span aria-current="page" className="truncate text-ink">
                {inv.title}
              </span>
            </nav>
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              {proposed > 0 && (
                <Button size="sm" variant="ghost" icon={<Play strokeWidth={1.5} />} onClick={() => provider.runProposed(inv.id)}>
                  Run proposed
                </Button>
              )}
              <Menu>
                <MenuTrigger asChild>
                  <Button size="sm" variant="ghost" icon={<Download strokeWidth={1.5} />}>
                    Export
                  </Button>
                </MenuTrigger>
                <MenuContent align="end" label="Export">
                  <MenuItem icon={<FileText strokeWidth={1.5} />} onSelect={exportMd}>
                    Markdown report
                  </MenuItem>
                  <MenuItem icon={<FileJson strokeWidth={1.5} />} onSelect={exportJson}>
                    JSON bundle
                  </MenuItem>
                  <MenuItem icon={<Printer strokeWidth={1.5} />} onSelect={print}>
                    Print
                  </MenuItem>
                </MenuContent>
              </Menu>
              <IconButton
                label={panelOpen ? "Hide details panel" : "Show details panel"}
                icon={<PanelRight strokeWidth={1.5} />}
                aria-pressed={panelOpen}
                onClick={() => setPanelOpen((v) => !v)}
              />
            </div>
          </div>

          <header className="mt-2">
            <h1 className="text-[30px] font-semibold leading-[38px] tracking-[-0.022em] text-ink">{inv.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-ink-2">
              <StatusLabel status={status} />
              <span aria-hidden className="text-ink-3">·</span>
              <Link href="/systems" className="hover:text-ink">
                {systemName(inv.systemId)}
              </Link>
              <span aria-hidden className="text-ink-3">·</span>
              <span>
                {inv.experiments.length} experiment{inv.experiments.length === 1 ? "" : "s"} · {count(n)} samples
              </span>
              <span aria-hidden className="text-ink-3">·</span>
              <span>
                Updated <Time iso={inv.updatedAt} now={now} />
              </span>
            </div>
          </header>

          <Tabs<Tab>
            className="no-print mt-5"
            idBase={`ws-${inv.id}`}
            label="Investigation views"
            value={state.tab}
            onChange={ctx.setTab}
            items={TABS.map((t) => ({ value: t, label: TAB_LABEL[t] }))}
          />
          <TabPanel idBase={`ws-${inv.id}`} value={state.tab} className="pt-6">
            {state.tab === "session" && <SessionTab />}
            {state.tab === "overview" && <OverviewTab />}
            {state.tab === "graph" && <GraphTab />}
            {state.tab === "evidence" && (
              <EvidenceBrowser
                key={evidenceFor ?? "all"}
                investigations={[inv]}
                initialExperiment={evidenceFor ?? "all"}
                onOpenTrace={(_, sid) => setTrace(sid)}
              />
            )}
            {state.tab === "report" && <ReportTab />}
          </TabPanel>
        </div>

        {showSide && (
          <motion.aside
            ref={asideRef}
            tabIndex={-1}
            aria-label="Experiment details"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            className="no-print quiet-scroll sticky top-0 h-dvh overflow-y-auto border-l border-line bg-bg outline-none"
          >
            <div className="flex items-center justify-end px-4 pt-3">
              <IconButton label="Close details panel" icon={<X strokeWidth={1.5} />} onClick={() => setPanelOpen(false)} />
            </div>
            <div className="px-5 pb-10">
              <motion.div key={exp?.id ?? "pick"} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
                {exp ? <ExperimentDetail exp={exp} /> : <PickExperiment onPick={ctx.openRef} />}
              </motion.div>
            </div>
          </motion.aside>
        )}
      </div>

      {!wide && (
        <Dialog open={panelOpen} onOpenChange={setPanelOpen} title={exp ? `${exp.id} ${exp.title}` : "Experiment details"} hideTitle variant="sheet-right">
          <div className="flex items-center justify-end px-4 pt-3">
            <DialogClose label="Close details panel" />
          </div>
          <div className="quiet-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-10">
            {exp ? <ExperimentDetail exp={exp} /> : <PickExperiment onPick={ctx.openRef} />}
          </div>
        </Dialog>
      )}
      <TraceViewer inv={inv} sampleId={trace} onClose={() => setTrace(null)} />
    </Ctx.Provider>
  );
}

function PickExperiment({ onPick }: { onPick: (id: string) => void }) {
  const { inv } = useWS();
  return (
    <div>
      <h2 className="text-[16px] font-medium text-ink">Experiment details</h2>
      <p className="mt-1 text-ink-2">Select an experiment to see its design, effect and reproducibility details.</p>
      <ul className="mt-4 space-y-1">
        {inv.experiments.map((e) => (
          <li key={e.id}>
            <button type="button" onClick={() => onPick(e.id)} className="flex w-full items-center gap-2 rounded-[6px] px-2 py-2 text-left hover:bg-sunken">
              <span className="font-mono text-[13px] text-ink-3">{e.id}</span>
              <span className="min-w-0 flex-1 truncate">{e.title}</span>
              <StatusLabel status={e.status} className="text-[13px]" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WorkspaceSkeleton() {
  return (
    <div className="px-4 pb-16 pt-3 sm:px-6 lg:px-8" aria-busy="true" aria-label="Loading investigation">
      <div className="h-12" />
      <Skeleton className="mt-2 h-8 w-2/3 max-w-[480px]" />
      <Skeleton className="mt-3 h-4 w-1/2 max-w-[360px]" />
      <div className="mt-6 flex gap-5 border-b border-line pb-3">
        {[64, 72, 52, 68, 56].map((w) => (
          <div key={w} style={{ width: w }}>
            <Skeleton className="h-4" />
          </div>
        ))}
      </div>
      <div className="mt-8 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
      </div>
    </div>
  );
}

