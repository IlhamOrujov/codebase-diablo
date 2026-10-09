"use client";

import { useEffect, useState } from "react";

const NAMES = { claude: "Claude Opus 5.5", gemini: "Gemini 3.8 Flash" } as const;

/**
 * The investigator model the whole system uses right now. Admins change it in
 * /admin; here it is shown, not chosen.
 */
export function InvestigatorPicker() {
  const [reasoner, setReasoner] = useState<keyof typeof NAMES>("claude");
  useEffect(() => {
    let alive = true;
    fetch("/api/live/options", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((o: { reasoner?: string } | null) => {
        if (alive && o?.reasoner === "gemini") setReasoner("gemini");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return (
    <span className="flex h-8 items-center gap-1.5 px-2 text-[13px] text-ink-2" aria-label={`Investigator model: ${NAMES[reasoner]}`}>
      <span className="size-1.5 rounded-full bg-accent-text" aria-hidden />
      {NAMES[reasoner]}
    </span>
  );
}
