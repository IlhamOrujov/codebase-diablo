"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";

export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
}

/**
 * WAI-ARIA tabs: arrow keys move and select (automatic activation), Home/End
 * jump, roving tabindex, aria-controls. A burgundy marker glides to the
 * selected tab; content switches instantly.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  idBase,
  label,
  className,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  idBase: string;
  label: string;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = items.findIndex((i) => i.value === value);

  const onKey = (e: KeyboardEvent) => {
    let next = -1;
    if (e.key === "ArrowRight") next = (index + 1) % items.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(items[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label={label} onKeyDown={onKey} className={cn("flex gap-5 overflow-x-auto border-b border-line", className)}>
      {items.map((item, i) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            type="button"
            id={`${idBase}-tab-${item.value}`}
            aria-selected={selected}
            aria-controls={`${idBase}-panel-${item.value}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.value)}
            className={cn(
              "relative -mb-px flex h-10 shrink-0 items-center gap-1.5 text-[14px] transition-colors duration-150",
              selected ? "font-medium text-ink" : "text-ink-2 hover:text-ink",
            )}
          >
            {item.label}
            {selected && (
              <motion.span
                layoutId={`tab-marker-${idBase}`}
                aria-hidden
                transition={{ type: "spring", stiffness: 520, damping: 40, mass: 0.7 }}
                className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-accent"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ idBase, value, children, className }: { idBase: string; value: string; children: ReactNode; className?: string }) {
  return (
    <div role="tabpanel" id={`${idBase}-panel-${value}`} aria-labelledby={`${idBase}-tab-${value}`} tabIndex={0} className={cn("focus-visible:outline-offset-4", className)}>
      {children}
    </div>
  );
}
