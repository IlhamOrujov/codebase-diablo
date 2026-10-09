"use client";

import { useState } from "react";

/** The system-wide Gemini switch. Saves at once; every next live run follows it. */
export function ReasonerSwitch({ initial, geminiAvailable, updatedAt }: { initial: "claude" | "gemini"; geminiAvailable: boolean; updatedAt: string | null }) {
  const [on, setOn] = useState(initial === "gemini");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(updatedAt);

  const toggle = async () => {
    const next = !on;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reasoner: next ? "gemini" : "claude" }),
    }).catch(() => null);
    setSaving(false);
    if (res?.ok) {
      const body = (await res.json()) as { updatedAt: string | null };
      setOn(next);
      setSaved(body.updatedAt);
      return;
    }
    const body = (await res?.json().catch(() => null)) as { message?: string } | null;
    setError(body?.message ?? "Could not save the setting.");
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Use Google Gemini for every live investigation"
        disabled={saving || (!on && !geminiAvailable)}
        onClick={toggle}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50 ${on ? "bg-accent" : "bg-line-strong"}`}
      >
        <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-[left] duration-200 ${on ? "left-[22px]" : "left-0.5"}`} />
      </button>
      <span className="text-[14px] text-ink">{on ? "On: Google Gemini (gemini-3.8-flash)" : "Off: Claude Opus 5.5"}</span>
      {saving && <span className="text-[13px] text-ink-3">Saving…</span>}
      {!geminiAvailable && !on && <span className="text-[13px] text-ink-3">GEMINI_API_KEY is not set.</span>}
      {saved && !saving && <span className="text-[12px] text-ink-3">Last changed {new Date(saved).toLocaleString()}</span>}
      {error && (
        <p role="alert" className="w-full text-[13px] text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
