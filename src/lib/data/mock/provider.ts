/**
 * MockProvider: the demo's in-browser data provider.
 *
 * - State lives in sessionStorage (this tab only), validated on load.
 * - Writes are debounced (250 ms), skipped when nothing changed, and flushed
 *   when the tab is hidden.
 * - A running run completes through its own timer; progress is derived from
 *   the clock, so there is no global ticker rewriting state.
 */
import { toast } from "@/lib/ui";
import { formatPP } from "@/lib/stats";
import { investigationId, titleFromQuestion } from "@/lib/slug";
import { assess } from "@/lib/validity";
import { analyzeExperiment, hashString } from "../derive";
import { answerQuestion, experimentInterpretation, investigationInterpretation } from "../interpret";
import type { DataProvider, WorkspaceSnapshot } from "../provider";
import { MAX_QUESTION } from "../provider";
import { investigationSchema, parseSaved, RESET_MESSAGE, STATE_VERSION, type Persisted } from "../schema";
import type { Experiment, Investigation, Run, SessionEvent } from "../types";
import { designInvestigation } from "./agent";
import { DATASETS, SYSTEMS } from "./catalog";
import { seedInvestigations } from "./fixtures";
import { DEMO_MODE } from "@/lib/demo-mode";
import { simulateRun } from "./simulate";
import { liveDataset } from "@/lib/live/dataset";
import { HELPER_CATALOG } from "@/lib/live/registry";

const LIVE_DATASET = liveDataset();

const KEY = "diablo.workspace";
/** Keys written by the first prototype; their shape is not compatible. */
const LEGACY_KEYS = ["diablo.investigations.v1"];

const SERVER_SNAPSHOT: WorkspaceSnapshot = { ready: false, investigations: [], notice: null, storage: "ok" };

let snap: WorkspaceSnapshot | null = null;
let seededAt = "";
let lastWritten: string | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;
const runTimers = new Map<string, ReturnType<typeof setTimeout>>();
const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    const s = window.sessionStorage;
    const probe = "diablo.probe";
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

function init(): WorkspaceSnapshot {
  const s = storage();
  let notice: string | null = null;
  let raw: string | null = null;
  if (s) {
    raw = s.getItem(KEY);
    if (raw === null && LEGACY_KEYS.some((k) => s.getItem(k) !== null)) notice = RESET_MESSAGE["old-version"];
    LEGACY_KEYS.forEach((k) => s.removeItem(k));
  }
  const res = parseSaved(raw);
  let investigations: Investigation[];
  if (res.kind === "ok") {
    investigations = res.data.investigations;
    seededAt = res.data.seededAt;
    lastWritten = raw;
  } else {
    const now = Date.now();
    seededAt = new Date(now).toISOString();
    investigations = DEMO_MODE ? seedInvestigations(now) : [];
    if (res.kind === "reset") notice = RESET_MESSAGE[res.reason];
  }
  snap = { ready: true, investigations, notice, storage: s ? "ok" : "unavailable" };
  if (res.kind !== "ok") schedulePersist();
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", flush);
  scheduleRuns();
  return snap;
}

function emit() {
  listeners.forEach((l) => l());
}

function serialize(): string {
  const data: Persisted = { version: STATE_VERSION, seededAt, investigations: snap!.investigations };
  return JSON.stringify(data);
}

function flush() {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  if (!snap || snap.storage === "unavailable") return;
  const json = serialize();
  if (json === lastWritten) return; // nothing changed: no write
  try {
    window.sessionStorage.setItem(KEY, json);
    lastWritten = json;
  } catch {
    snap = { ...snap, storage: "unavailable" };
    emit();
  }
}

function schedulePersist() {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(flush, 250);
}

function update(fn: (list: Investigation[]) => Investigation[]) {
  const s = getSnapshot();
  const next = fn(s.investigations);
  if (next === s.investigations) return;
  snap = { ...s, investigations: next };
  emit();
  schedulePersist();
  scheduleRuns();
}

function updateInvestigation(id: string, fn: (inv: Investigation) => Investigation) {
  update((list) => {
    const i = list.findIndex((x) => x.id === id);
    if (i < 0) return list;
    const next = fn(list[i]);
    if (next === list[i]) return list;
    const copy = list.slice();
    copy[i] = next;
    return copy;
  });
}

const nowIso = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString();

let evSeq = 0;
function event(inv: Investigation, kind: SessionEvent["kind"], text: string, refs: string[], experimentId: string | null, offsetMs = 0): SessionEvent {
  return { id: `${inv.id}/ev-${Date.now().toString(36)}-${++evSeq}`, kind, at: nowIso(offsetMs), text, refs, experimentId };
}

const findSystem = (id: string) => SYSTEMS.find((s) => s.id === id) ?? HELPER_CATALOG.find((s) => s.id === id);
const familyOf = (systemId: string) => findSystem(systemId)?.family ?? null;

/* ── Runs ──────────────────────────────────────────────────────── */

/** One timer per running run. Clears timers whose run is gone or finished. */
function scheduleRuns() {
  if (!snap) return;
  const live = new Set<string>();
  for (const inv of snap.investigations) {
    for (const exp of inv.experiments) {
      for (const run of exp.runs) {
        if (run.finishedAt !== null) continue;
        live.add(run.id);
        if (runTimers.has(run.id)) continue;
        const due = Date.parse(run.startedAt) + run.expectedDurationMs - Date.now();
        const invId = inv.id;
        const expId = exp.id;
        runTimers.set(
          run.id,
          setTimeout(() => {
            runTimers.delete(run.id);
            completeRun(invId, expId, run.id);
          }, Math.max(0, due)),
        );
      }
    }
  }
  for (const [id, t] of runTimers) {
    if (!live.has(id)) {
      clearTimeout(t);
      runTimers.delete(id);
    }
  }
}

function completeRun(invId: string, expId: string, runId: string) {
  let finishedExp: Experiment | null = null;
  let finishedRun: Run | null = null;
  updateInvestigation(invId, (inv) => {
    const exp = inv.experiments.find((e) => e.id === expId);
    const run = exp?.runs.find((r) => r.id === runId);
    if (!exp || !run || run.finishedAt !== null) return inv;
    const sim = simulateRun(exp, run);
    const doneRun: Run = {
      ...run,
      finishedAt: new Date(Math.min(Date.now(), Date.parse(run.startedAt) + run.expectedDurationMs)).toISOString(),
      counts: sim.counts,
      discordant: sim.discordant,
      sweep: sim.sweep,
      grid: sim.grid,
      samples: sim.samples,
      traces: sim.traces,
    };
    const stillRunning = exp.runs.some((r) => r.id !== run.id && r.finishedAt === null);
    const nextExp: Experiment = {
      ...exp,
      status: stillRunning ? "running" : "complete",
      runs: exp.runs.map((r) => (r.id === run.id ? doneRun : r)),
      updatedAt: nowIso(),
    };
    finishedExp = nextExp;
    finishedRun = doneRun;
    let next: Investigation = {
      ...inv,
      updatedAt: nowIso(),
      experiments: inv.experiments.map((e) => (e.id === exp.id ? nextExp : e)),
    };
    const isReplication = run.role === "replication";
    const events = [
      event(
        next,
        "run-finished",
        isReplication ? `Replicated ${exp.id} · ${exp.title}` : `Ran ${exp.id} · ${exp.title}`,
        [exp.id],
        exp.id,
      ),
    ];
    if (!isReplication) events.push(event(next, "analysis", experimentInterpretation(nextExp), [exp.id, exp.hypothesisId], exp.id));
    next = { ...next, events: [...next.events, ...events] };
    if (!next.experiments.some((e) => e.status === "running")) {
      next = {
        ...next,
        events: [...next.events, event(next, "conclusion", investigationInterpretation(next), next.hypotheses.map((h) => h.id), null)],
      };
    }
    return next;
  });
  if (finishedExp && finishedRun) {
    const e = finishedExp as Experiment;
    const r = (finishedRun as Run).role === "primary" ? analyzeExperiment(e) : null;
    toast({ title: `${e.id} finished`, body: r ? `${e.title} · Δ ${formatPP(r.diff)}` : e.title });
  }
}

function newRun(inv: Investigation, exp: Experiment, role: Run["role"]): Run {
  const index = exp.runs.length + 1;
  const id = `${inv.id}/${exp.id}/${role}-${index}`;
  const system = SYSTEMS.find((s) => s.id === exp.design.treatment.systemId);
  // Demo runs take 6 to 11 seconds so the result arrives while you watch.
  const expectedDurationMs = 6000 + (hashString(id) % 5000);
  return {
    id,
    experimentId: exp.id,
    role,
    startedAt: nowIso(),
    finishedAt: null,
    expectedDurationMs,
    counts: null,
    discordant: null,
    sweep: null,
    grid: null,
    modelVersion: system?.versionString ?? null,
    params: exp.design.temperature !== null ? { temperature: String(exp.design.temperature) } : null,
    datasetHash: DATASETS.find((d) => d.id === exp.design.datasetId)?.hash ?? null,
    configHash: `cfg:${hashString(JSON.stringify(exp.design)).toString(16).padStart(8, "0")}`,
    tokens: null,
    costUsd: null,
    samples: [],
    traces: [],
  };
}

function startRun(invId: string, expId: string, role: Run["role"], allow: (e: Experiment) => boolean) {
  const target = getSnapshot().investigations.find((i) => i.id === invId)?.experiments.find((e) => e.id === expId);
  // A live experiment has no simulation prior: it is never re-run with made-up data.
  if (target && target.simulation === null) {
    toast({ title: "Live experiments are not simulated", body: "Start a new run on the Live investigation page." });
    return;
  }
  updateInvestigation(invId, (inv) => {
    const exp = inv.experiments.find((e) => e.id === expId);
    if (!exp || !allow(exp)) return inv;
    const run = newRun(inv, exp, role);
    const runs =
      role === "primary" ? exp.runs.map((r) => (r.role === "primary" ? { ...r, role: "superseded" as const } : r)) : exp.runs;
    const nextExp: Experiment = { ...exp, status: "running", runs: [...runs, run], updatedAt: nowIso() };
    const text =
      role === "replication"
        ? `Started a replication of ${exp.id} with a new seed`
        : exp.status === "complete"
          ? `Re-ran ${exp.id} · ${exp.title}`
          : `Started ${exp.id} · ${exp.title}`;
    return {
      ...inv,
      updatedAt: nowIso(),
      experiments: inv.experiments.map((e) => (e.id === exp.id ? nextExp : e)),
      events: [...inv.events, event(inv, "run-started", text, [exp.id], exp.id)],
    };
  });
}

/* ── Provider ──────────────────────────────────────────────────── */

export function getSnapshot(): WorkspaceSnapshot {
  return snap ?? init();
}

export const mockProvider: DataProvider = {
  kind: "mock",
  label: "Demo data",

  subscribe(listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot,
  getServerSnapshot: () => SERVER_SNAPSHOT,

  listSystems: () => SYSTEMS,
  getSystem: findSystem,
  listDatasets: () => DATASETS,
  getDataset: (id) => DATASETS.find((d) => d.id === id) ?? (id === LIVE_DATASET.id ? LIVE_DATASET : undefined),

  createInvestigation(question, systemId) {
    const q = question.trim().slice(0, MAX_QUESTION);
    const system = SYSTEMS.find((s) => s.id === systemId) ?? SYSTEMS[0];
    const title = titleFromQuestion(q);
    const id = investigationId(title);
    const created = nowIso();
    const design = designInvestigation(q, system, created);
    const inv: Investigation = {
      id,
      title,
      question: q,
      systemId: system.id,
      createdAt: created,
      updatedAt: created,
      hypotheses: design.hypotheses,
      experiments: design.experiments,
      events: [],
      notes: "",
      pinned: false,
      templateDraft: design.templateDraft,
      failed: false,
    };
    // The agent's log arrives 0.4 to 1.2 s apart (3 s in total at most); the UI shows events whose time has come.
    const events: SessionEvent[] = [event(inv, "question", q, [], null, 0)];
    events.push(
      event(
        inv,
        "hypotheses",
        `${design.templateDraft ? "Template draft: " : ""}Proposed ${design.hypotheses.length} hypotheses`,
        design.hypotheses.map((h) => h.id),
        null,
        600,
      ),
    );
    design.experiments.forEach((e, i) =>
      events.push(event(inv, "design", `Designed ${e.id} · ${e.title}`, [e.id, e.hypothesisId], e.id, 1200 + i * 550)),
    );
    update((list) => [{ ...inv, events }, ...list]);
    return id;
  },

  runExperiment(invId, expId) {
    startRun(invId, expId, "primary", (e) => e.status === "proposed" || e.status === "failed");
  },
  runProposed(invId) {
    const inv = getSnapshot().investigations.find((i) => i.id === invId);
    inv?.experiments.filter((e) => e.status === "proposed").forEach((e) => mockProvider.runExperiment(invId, e.id));
  },
  rerunExperiment(invId, expId) {
    startRun(invId, expId, "primary", (e) => e.status === "complete" || e.status === "failed");
  },
  replicateExperiment(invId, expId) {
    startRun(invId, expId, "replication", (e) => e.status === "complete");
  },

  ask(invId, question) {
    const text = question.trim().slice(0, MAX_QUESTION);
    if (!text) return;
    updateInvestigation(invId, (inv) => {
      const answer = answerQuestion(inv, text, assess(inv, familyOf));
      return {
        ...inv,
        events: [...inv.events, event(inv, "ask", text, [], null), event(inv, "answer", answer.text, answer.refs, null, 1)],
      };
    });
  },
  addNote(invId, text) {
    const t = text.trim().slice(0, MAX_QUESTION);
    if (!t) return;
    updateInvestigation(invId, (inv) => ({ ...inv, updatedAt: nowIso(), events: [...inv.events, event(inv, "note", t, [], null)] }));
  },
  setNotes(invId, notes) {
    updateInvestigation(invId, (inv) => (inv.notes === notes ? inv : { ...inv, notes: notes.slice(0, 4000) }));
  },
  rename(invId, title) {
    const t = title.trim().slice(0, 200);
    if (!t) return;
    updateInvestigation(invId, (inv) => (inv.title === t ? inv : { ...inv, title: t }));
  },
  setPinned(invId, pinned) {
    updateInvestigation(invId, (inv) => (inv.pinned === pinned ? inv : { ...inv, pinned }));
  },
  importInvestigation(investigation) {
    const parsed = investigationSchema.safeParse(investigation);
    if (!parsed.success) return null;
    const inv = parsed.data as Investigation;
    update((list) => [inv, ...list.filter((i) => i.id !== inv.id)]);
    return inv.id;
  },
  remove(invId) {
    update((list) => (list.some((i) => i.id === invId) ? list.filter((i) => i.id !== invId) : list));
  },
  toggleFlag(invId, sampleId) {
    updateInvestigation(invId, (inv) => ({
      ...inv,
      experiments: inv.experiments.map((e) =>
        e.runs.some((r) => r.samples.some((s) => s.id === sampleId))
          ? {
              ...e,
              runs: e.runs.map((r) =>
                r.samples.some((s) => s.id === sampleId)
                  ? { ...r, samples: r.samples.map((s) => (s.id === sampleId ? { ...s, flagged: !s.flagged } : s)) }
                  : r,
              ),
            }
          : e,
      ),
    }));
  },

  exportAll() {
    getSnapshot();
    return JSON.stringify(
      { exportedAt: nowIso(), provider: "mock (demo data)", version: STATE_VERSION, investigations: snap!.investigations },
      null,
      2,
    );
  },
  resetAll() {
    try {
      window.sessionStorage.removeItem(KEY);
    } catch {}
    const now = Date.now();
    seededAt = new Date(now).toISOString();
    lastWritten = null;
    snap = { ...getSnapshot(), investigations: DEMO_MODE ? seedInvestigations(now) : [], notice: null };
    emit();
    schedulePersist();
    scheduleRuns();
  },
  dismissNotice() {
    const s = getSnapshot();
    if (!s.notice) return;
    snap = { ...s, notice: null };
    emit();
  },
};
