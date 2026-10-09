"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { ExperimentsTable } from "@/components/research/OverviewTab";
import { EvidenceBrowser } from "@/components/research/EvidenceBrowser";
import { InvestigationRow, keyResult, RowSkeleton } from "@/components/research/InvestigationRow";
import { TraceViewer } from "@/components/research/TraceViewer";
import { Facts, Mono } from "@/components/research/common";
import { Dialog, DialogClose } from "@/components/ui/Dialog";
import { StatusDot, STATUS_LABEL } from "@/components/ui/Status";
import { EmptyState, ScrollRegion } from "@/components/ui/primitives";
import { provider, sortInvestigations, systemName, useNow, useWorkspace } from "@/lib/data";
import { analyzeExperiment, finishedExperiments, investigationStatus } from "@/lib/data/derive";
import { investigationInterpretation, strengthLine } from "@/lib/data/interpret";
import type { Dataset, Investigation, InvestigationStatus } from "@/lib/data/types";
import { count, longDate } from "@/lib/format";
import { assess } from "@/lib/validity";
import { familyOf } from "@/lib/data";

import { formatCIpp, formatPP } from "@/lib/stats";

export function PageHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <header>
      <h1 className="rise text-[28px] font-semibold leading-[34px] tracking-[-0.02em] text-ink">{title}</h1>
      <p className="mt-1 text-ink-2">{sub}</p>
    </header>
  );
}

export function Page({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-[1040px] px-4 pb-16 pt-8 sm:px-6 md:pt-12">{children}</div>;
}

const field = "h-9 rounded-[6px] border border-line-field bg-surface px-2 text-[13px] text-ink";

/* ── Investigations ────────────────────────────────────────────── */

export function InvestigationsPage() {
  const ws = useWorkspace();
  const now = useNow(60_000, ws.ready);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | InvestigationStatus>("all");
  const [system, setSystem] = useState("all");
  const [sort, setSort] = useState<"updated" | "title" | "created">("updated");

  const needle = q.trim().toLowerCase();
  let list = sortInvestigations(ws.investigations).filter(
    (i) =>
      (status === "all" || investigationStatus(i) === status) &&
      (system === "all" || i.systemId === system) &&
      (!needle || `${i.title} ${i.question} ${systemName(i.systemId)}`.toLowerCase().includes(needle)),
  );
  if (sort === "title") list = [...list].sort((a, b) => a.title.localeCompare(b.title));
  if (sort === "created") list = [...list].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const systems = Array.from(new Set(ws.investigations.map((i) => i.systemId)));

  return (
    <Page>
      <PageHeader title="Investigations" sub="Every question in this workspace, with its status and key result." />
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
        <label className="col-span-2 flex flex-col gap-1 text-[12px] text-ink-3 lg:col-span-1">
          Search
          <span className="field-box flex h-9 items-center gap-2 rounded-[6px] border border-line-field bg-surface px-2">
            <Search className="size-4 text-ink-3" strokeWidth={1.5} aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Title, question or system…"
              className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-3"
            />
          </span>
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-ink-3">
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={field}>
            <option value="all">All</option>
            {(["draft", "running", "needs-review", "complete", "replicated", "failed"] as const).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-ink-3">
          AI system
          <select value={system} onChange={(e) => setSystem(e.target.value)} className={field}>
            <option value="all">All</option>
            {systems.map((s) => (
              <option key={s} value={s}>
                {systemName(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-ink-3">
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className={field}>
            <option value="updated">Recently updated</option>
            <option value="created">Recently created</option>
            <option value="title">Title</option>
          </select>
        </label>
      </div>
      <div className="mt-6">
        {!ws.ready ? (
          <RowSkeleton />
        ) : ws.investigations.length === 0 ? (
          <EmptyState action={<Link href="/home" className="text-accent-text underline underline-offset-2">Ask a question</Link>}>
            No investigations yet.
          </EmptyState>
        ) : list.length === 0 ? (
          <EmptyState>No investigations match these filters.</EmptyState>
        ) : (
          <ul aria-label="Investigations">
            {list.map((inv) => (
              <InvestigationRow key={inv.id} inv={inv} now={now} />
            ))}
          </ul>
        )}
      </div>
    </Page>
  );
}

/* ── AI systems ────────────────────────────────────────────────── */

const KIND: Record<string, string> = { model: "Model", agent: "Agent", app: "App" };

export function SystemsPage() {
  const ws = useWorkspace();
  const products = Array.from(new Set(provider.listSystems().map((s) => s.product)));
  return (
    <Page>
      <PageHeader title="AI systems" sub="The models, agents and apps under study, with their versions and latest results." />
      <div className="mt-8 space-y-4">
        {products.map((p) => {
          const versions = provider.listSystems().filter((s) => s.product === p);
          const invs = ws.investigations.filter((i) => versions.some((v) => v.id === i.systemId));
          const latest = sortInvestigations(invs).find((i) => finishedExperiments(i).length);
          return (
            <section key={p} className="rounded-[10px] border border-line bg-surface p-4" aria-labelledby={`sys-${p}`}>
              <div className="flex flex-wrap items-baseline gap-x-3">
                <h2 id={`sys-${p}`} className="text-[16px] font-medium text-ink">
                  {p}
                </h2>
                <span className="text-[13px] text-ink-3">{KIND[versions[0].kind]}</span>
                <span className="text-[13px] text-ink-3">· family {versions[0].family ?? "not recorded"}</span>
              </div>
              <p className="mt-1 text-ink-2">{versions[0].description}</p>
              <table className="mt-3 w-full text-[13px]">
                <caption className="sr-only">Versions of {p}</caption>
                <thead>
                  <tr className="border-b border-line text-left text-ink-3">
                    <th scope="col" className="py-1.5 pr-3 font-normal">Version</th>
                    <th scope="col" className="py-1.5 pr-3 font-normal">Build</th>
                    <th scope="col" className="py-1.5 text-right font-normal">Investigations</th>
                  </tr>
                </thead>
                <tbody>
                  {versions.map((v) => (
                    <tr key={v.id} className="border-b border-line last:border-0">
                      <td className="py-1.5 pr-3 text-ink">{v.name}</td>
                      <td className="py-1.5 pr-3 font-mono text-ink-2">{v.versionString ?? <span className="font-sans text-ink-3">Not recorded</span>}</td>
                      <td className="py-1.5 text-right font-mono text-ink-2">{ws.ready ? ws.investigations.filter((i) => i.systemId === v.id).length : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {ws.ready && (
                <p className="mt-3 text-[13px] text-ink-2">
                  {latest ? (
                    <>
                      Latest result:{" "}
                      <Link href={`/investigations/${latest.id}?tab=overview`} className="text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink">
                        {latest.title}
                      </Link>{" "}
                      · <Mono>{keyResult(latest)}</Mono>
                    </>
                  ) : invs.length ? (
                    "No finished experiments yet."
                  ) : (
                    "Not investigated yet."
                  )}
                </p>
              )}
            </section>
          );
        })}
      </div>
      <p className="mt-6 text-[13px] text-ink-3">Connecting your own systems is not available in the demo.</p>
    </Page>
  );
}

/* ── Experiments (across investigations) ──────────────────────── */

export function ExperimentsPage() {
  const ws = useWorkspace();
  const router = useRouter();
  const rows = ws.investigations.flatMap((inv) => inv.experiments.map((e) => ({ inv, e })));
  return (
    <Page>
      <PageHeader title="Experiments" sub="Every experiment across investigations. Select a row to open it." />
      <div className="mt-6">
        {!ws.ready ? (
          <RowSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState>No experiments yet.</EmptyState>
        ) : (
          <ExperimentsTable
            experiments={rows.map((r) => r.e)}
            showInvestigation
            invOf={(e) => rows.find((r) => r.e === e)?.inv}
            onOpen={(e) => {
              const inv = rows.find((r) => r.e === e)?.inv;
              if (inv) router.push(`/investigations/${inv.id}?tab=overview&exp=${e.id}`);
            }}
          />
        )}
      </div>
    </Page>
  );
}

/* ── Evidence (across investigations) ─────────────────────────── */

export function EvidencePage() {
  const ws = useWorkspace();
  const [trace, setTrace] = useState<{ inv: Investigation; id: string } | null>(null);
  return (
    <Page>
      <PageHeader title="Evidence" sub="Scored samples from every experiment, traceable to the run that produced them." />
      <div className="mt-6">
        {!ws.ready ? (
          <RowSkeleton />
        ) : (
          <EvidenceBrowser investigations={ws.investigations} showInvestigation onOpenTrace={(inv, id) => setTrace({ inv, id })} />
        )}
      </div>
      <TraceViewer inv={trace?.inv ?? null} sampleId={trace?.id ?? null} onClose={() => setTrace(null)} />
    </Page>
  );
}

/* ── Datasets ──────────────────────────────────────────────────── */

export function DatasetsPage() {
  const [open, setOpen] = useState<Dataset | null>(null);
  return (
    <Page>
      <PageHeader title="Datasets" sub="Item sets used as experimental conditions." />
      <ScrollRegion label="Datasets table" className="mt-6 rounded-[10px] border border-line bg-surface">
        <table className="w-full min-w-[720px] text-[13px]">
          <caption className="sr-only">Datasets. Open one to see its schema and sample rows.</caption>
          <thead className="border-b border-line text-left text-ink-3">
            <tr>
              <th scope="col" className="px-3 py-2 font-normal">Name</th>
              <th scope="col" className="px-2 py-2 text-right font-normal">Size</th>
              <th scope="col" className="px-2 py-2 font-normal">Split</th>
              <th scope="col" className="px-2 py-2 font-normal">Held out</th>
              <th scope="col" className="px-2 py-2 font-normal">Hash</th>
              <th scope="col" className="px-3 py-2 font-normal">Description</th>
            </tr>
          </thead>
          <tbody>
            {provider.listDatasets().map((d) => (
              <tr key={d.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2">
                  <button type="button" onClick={() => setOpen(d)} className="font-mono text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink">
                    {d.name}
                  </button>
                </td>
                <td className="px-2 py-2 text-right font-mono tabular text-ink-2">{count(d.size)}</td>
                <td className="px-2 py-2 text-ink-2">{d.split}</td>
                <td className="px-2 py-2 text-ink-2">{d.heldOut === null ? <span className="text-ink-3">Not recorded</span> : d.heldOut ? "Yes" : "No"}</td>
                <td className="px-2 py-2 font-mono text-ink-2">{d.hash ?? <span className="font-sans text-ink-3">Not recorded</span>}</td>
                <td className="px-3 py-2 text-ink-2">{d.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollRegion>
      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)} title={open?.name ?? "Dataset"} hideTitle variant="sheet-right">
        {open && (
          <>
            <div className="flex items-center gap-2 border-b border-line px-5 py-3">
              <h2 className="font-mono text-[15px] text-ink">{open.name}</h2>
              <DialogClose className="ml-auto" />
            </div>
            <div className="quiet-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <p className="text-ink-2">{open.description}</p>
              <Facts
                className="mt-4"
                rows={[
                  ["Size", `${count(open.size)} items`],
                  ["Split", open.split],
                  ["Held out", open.heldOut === null ? null : open.heldOut ? "Yes" : "No"],
                  ["Hash", open.hash ? <Mono key="h">{open.hash}</Mono> : null],
                ]}
              />
              <h3 className="mt-6 text-[13px] font-medium text-ink">Schema</h3>
              <table className="mt-2 w-full text-[13px]">
                <tbody>
                  {open.schema.map((f) => (
                    <tr key={f.name} className="border-b border-line last:border-0">
                      <th scope="row" className="py-1.5 pr-3 text-left font-mono font-normal text-ink">{f.name}</th>
                      <td className="py-1.5 pr-3 font-mono text-ink-2">{f.type}</td>
                      <td className="py-1.5 text-ink-2">{f.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h3 className="mt-6 text-[13px] font-medium text-ink">Sample rows (5)</h3>
              <ScrollRegion label="Sample rows" className="mt-2">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-line text-left text-ink-3">
                      {Object.keys(open.sampleRows[0] ?? {}).map((k) => (
                        <th key={k} scope="col" className="py-1.5 pr-3 font-mono font-normal">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {open.sampleRows.map((r, i) => (
                      <tr key={i} className="border-b border-line align-top last:border-0">
                        {Object.values(r).map((v, j) => (
                          <td key={j} className="py-1.5 pr-3 text-ink-2">{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollRegion>
            </div>
          </>
        )}
      </Dialog>
    </Page>
  );
}

/* ── Reports ───────────────────────────────────────────────────── */

export function ReportsPage() {
  const ws = useWorkspace();
  const reports = sortInvestigations(ws.investigations).filter((i) => finishedExperiments(i).length > 0);
  return (
    <Page>
      <PageHeader title="Reports" sub="A report for every investigation with at least one finished experiment." />
      <div className="mt-6">
        {!ws.ready ? (
          <RowSkeleton />
        ) : reports.length === 0 ? (
          <EmptyState>No reports yet. A report appears when an experiment finishes.</EmptyState>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {reports.map((inv) => {
              const a = assess(inv, familyOf);
              const head = finishedExperiments(inv)[0];
              const r = analyzeExperiment(head)!;
              return (
                <li key={inv.id}>
                  <Link href={`/investigations/${inv.id}?tab=report`} className="block rounded-[6px] px-3 py-3 hover:bg-sunken">
                    <span className="flex items-center gap-2">
                      <StatusDot status={investigationStatus(inv)} />
                      <span className="font-serif text-[18px] leading-6 text-ink">{inv.title}</span>
                    </span>
                    <span className="mt-1 block text-[13px] text-ink-2">
                      {strengthLine(a)} · <Mono>{head.id} Δ {formatPP(r.diff)} [{formatCIpp(r.diffCI)}]</Mono>
                    </span>
                    <span className="mt-0.5 block text-[12px] text-ink-3">
                      {systemName(inv.systemId)} · <time dateTime={inv.updatedAt}>{longDate(inv.updatedAt)}</time>
                    </span>
                    <span className="mt-1 line-clamp-2 block font-serif text-[15px] leading-[22px] text-ink-2">{investigationInterpretation(inv)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Page>
  );
}
