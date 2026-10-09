import type { AISystem, Dataset, Investigation } from "./types";

export interface WorkspaceSnapshot {
  /** False on the server and before the browser store has loaded. */
  ready: boolean;
  investigations: Investigation[];
  /** A one-off message, e.g. after saved data had to be reset. */
  notice: string | null;
  /** "unavailable" when the browser refuses storage (private mode, blocked site data). */
  storage: "ok" | "unavailable";
}

/**
 * Everything the UI may do with data goes through this interface. Today there
 * is one implementation, the in-browser MockProvider; a real backend would
 * implement the same methods.
 */
export interface DataProvider {
  readonly kind: "mock";
  /** Shown to users while the provider serves demo data. */
  readonly label: string;

  subscribe(listener: () => void): () => void;
  getSnapshot(): WorkspaceSnapshot;
  getServerSnapshot(): WorkspaceSnapshot;

  listSystems(): AISystem[];
  getSystem(id: string): AISystem | undefined;
  listDatasets(): Dataset[];
  getDataset(id: string): Dataset | undefined;

  createInvestigation(question: string, systemId: string): string;
  runExperiment(investigationId: string, experimentId: string): void;
  runProposed(investigationId: string): void;
  rerunExperiment(investigationId: string, experimentId: string): void;
  replicateExperiment(investigationId: string, experimentId: string): void;
  ask(investigationId: string, question: string): void;
  addNote(investigationId: string, text: string): void;
  setNotes(investigationId: string, notes: string): void;
  rename(investigationId: string, title: string): void;
  setPinned(investigationId: string, pinned: boolean): void;
  remove(investigationId: string): void;
  /** Adds a finished investigation recorded elsewhere (a live run). Returns its id, or null when it does not validate. */
  importInvestigation(investigation: Investigation): string | null;
  toggleFlag(investigationId: string, sampleId: string): void;

  exportAll(): string;
  resetAll(): void;
  dismissNotice(): void;
}

/** Longest question the composer accepts. */
export const MAX_QUESTION = 2000;
