"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Kbd } from "@/components/ui/primitives";
import { provider, useWorkspace } from "@/lib/data";
import { useModKey } from "@/lib/platform";
import { dismissToast, ui, useUI, type Toast } from "@/lib/ui";

export function ShortcutsDialog() {
  const open = useUI((s) => s.shortcuts);
  const mod = useModKey();
  const m = mod === "⌘" ? "⌘" : "Ctrl";
  const rows: [string, string[]][] = [
    ["Open the command palette", [m, "K"]],
    ["Collapse or expand the sidebar", [m, "\\"]],
    ["Show keyboard shortcuts", ["?"]],
    ["Send (in a composer)", ["Enter"]],
    ["New line (in a composer)", ["Shift", "Enter"]],
    ["Switch tabs (when a tab is focused)", ["←", "→"]],
    ["Graph: move between nodes", ["←", "↑", "→", "↓"]],
    ["Graph: zoom in, out, fit", ["+", "−", "0"]],
    ["Close a dialog, menu or panel", ["Esc"]],
  ];
  return (
    <Dialog open={open} onOpenChange={ui.setShortcuts} title="Keyboard shortcuts">
      <dl className="divide-y divide-line px-5 pb-5 pt-3">
        {rows.map(([label, keys]) => (
          <div key={label} className="flex items-center justify-between gap-4 py-2">
            <dt className="text-ink-2">{label}</dt>
            <dd className="flex shrink-0 gap-1">
              {keys.map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}

/** Toasts: a polite live region; each toast pauses while hovered or focused. */
export function Toasts() {
  const toasts = useUI((s) => s.toasts);
  return (
    <div
      role="status"
      aria-live="polite"
      className="no-print pointer-events-none fixed inset-x-4 bottom-[calc(16px+env(safe-area-inset-bottom))] z-[70] flex flex-col items-stretch gap-2 sm:left-auto sm:right-4 sm:w-[340px]"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const [paused, setPaused] = useState(false);
  const left = useRef(5000);
  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    const t = setTimeout(() => dismissToast(toast.id), left.current);
    return () => {
      clearTimeout(t);
      left.current -= Date.now() - started;
    };
  }, [paused, toast.id]);
  return (
    <div
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pop-in pointer-events-auto flex items-start gap-3 rounded-[10px] border border-line bg-surface px-3.5 py-3 shadow-[var(--shadow-2)]"
      data-state="open"
    >
      <div className="min-w-0 flex-1">
        <div className="font-medium text-ink">{toast.title}</div>
        {toast.body && <div className="mt-0.5 truncate font-mono text-[13px] text-ink-2">{toast.body}</div>}
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => dismissToast(toast.id)}
        className="grid size-6 shrink-0 place-items-center rounded-[4px] text-ink-3 hover:bg-sunken hover:text-ink"
      >
        <X className="size-4" strokeWidth={1.5} />
      </button>
    </div>
  );
}

/** Storage problems and data resets are said out loud, never silent. */
export function StorageBanner() {
  const ws = useWorkspace();
  if (!ws.ready) return null;
  if (ws.storage === "unavailable") {
    return (
      <div role="alert" className="no-print border-b border-line bg-subtle px-4 py-2 text-[13px] text-ink-2">
        Can&apos;t save locally. Private mode? Changes will be lost when you reload.
      </div>
    );
  }
  if (ws.notice) {
    return (
      <div role="alert" className="no-print flex items-center gap-3 border-b border-line bg-subtle px-4 py-2 text-[13px] text-ink-2">
        <span className="flex-1">{ws.notice}</span>
        <button type="button" onClick={() => provider.dismissNotice()} className="rounded-[6px] px-2 py-1 text-ink hover:bg-sunken">
          Dismiss
        </button>
      </div>
    );
  }
  return null;
}
