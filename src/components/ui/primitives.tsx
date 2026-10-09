"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useModKey } from "@/lib/platform";
import { absoluteTime, relativeTime } from "@/lib/format";

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] border border-line bg-surface px-1 font-mono text-[12px] leading-none text-ink-3",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

/** "Ctrl K" on Windows and Linux, "⌘K" on macOS (decided after mount). */
export function ModKey({ k, className }: { k: string; className?: string }) {
  const mod = useModKey();
  return (
    <span className={cn("font-mono text-[12px] text-ink-3", className)}>
      {mod === "⌘" ? `⌘${k}` : `Ctrl ${k}`}
    </span>
  );
}

/** Relative time inline, absolute time on hover. Render only on the client (needs `now`). */
export function Time({ iso, now, className }: { iso: string; now: number; className?: string }) {
  return (
    <time dateTime={iso} title={absoluteTime(iso)} className={className}>
      {relativeTime(iso, now)}
    </time>
  );
}

/** A progress bar; its fill glides between values (transform only). */
export function Progress({ value, label, className }: { value: number; label: string; className?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn("h-1 overflow-hidden rounded-full bg-sunken", className)}
    >
      <div
        className="h-full origin-left rounded-full bg-accent transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ transform: `scaleX(${pct / 100})` }}
      />
    </div>
  );
}

/** One sentence and one action. */
export function EmptyState({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-start gap-3 rounded-[10px] border border-dashed border-line-strong px-5 py-8 text-ink-2", className)}>
      <p>{children}</p>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("rounded-[6px] bg-sunken", className)} />;
}

/** The quiet "Interpretation" label that precedes AI-written text. */
export function Interpretation({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="text-[12px] text-ink-3">Interpretation</div>
      <div className="mt-1 font-serif text-[16px] leading-[26px] text-ink">{children}</div>
    </div>
  );
}

export function SectionTitle({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <h2 id={id} className={cn("text-[14px] font-medium text-ink", className)}>
      {children}
    </h2>
  );
}

export function SimulatedTag({ className }: { className?: string }) {
  return (
    <span className={cn("rounded-[4px] border border-line px-1 text-[12px] leading-[18px] text-ink-3", className)}>Simulated</span>
  );
}

/** A horizontally scrollable region (wide tables). Focusable so keyboard users can scroll it. */
export function ScrollRegion({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className={cn("overflow-x-auto focus-visible:outline-offset-0", className)}>
      {children}
    </div>
  );
}
