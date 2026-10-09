"use client";

import { createContext, useContext } from "react";
import type { Investigation } from "@/lib/data/types";
import type { Assessment } from "@/lib/validity";

export type Tab = "session" | "overview" | "graph" | "evidence" | "report";
/** Overview first (brand spec §8: question, hypotheses, graph); the session log is there when you want it (§11). */
export const TABS: Tab[] = ["overview", "graph", "evidence", "report", "session"];

export interface WorkspaceCtx {
  inv: Investigation;
  assessment: Assessment;
  tab: Tab;
  setTab: (t: Tab) => void;
  /** Open the experiment detail panel (E1…), or a hypothesis's first experiment (H1…). */
  openRef: (ref: string) => void;
  openTrace: (sampleId: string) => void;
  /** The experiment open in the detail panel. */
  selectedExp: string | null;
  /** Evidence filter preset when jumping from an experiment. */
  evidenceFor: string | null;
  showEvidence: (experimentId: string) => void;
}

export const Ctx = createContext<WorkspaceCtx | null>(null);

export function useWS(): WorkspaceCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useWS outside the workspace");
  return c;
}
