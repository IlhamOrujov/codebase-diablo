"use client";

import * as P from "@radix-ui/react-popover";
import { Command } from "cmdk";
import { Check, ChevronDown } from "lucide-react";
import { useLayoutEffect, useState, useSyncExternalStore } from "react";
import { provider } from "@/lib/data";

const KEY = "diablo.system";
const listeners = new Set<() => void>();

function readSystem(): string {
  try {
    const v = localStorage.getItem(KEY);
    if (v && provider.getSystem(v)) return v;
  } catch {}
  return provider.listSystems()[0].id;
}

/** The chosen AI system, saved per browser. */
export function useSelectedSystem(): [string, (id: string) => void] {
  const id = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    readSystem,
    () => provider.listSystems()[0].id,
  );
  const set = (next: string) => {
    try {
      localStorage.setItem(KEY, next);
    } catch {}
    listeners.forEach((l) => l());
  };
  return [id, set];
}

const KIND: Record<string, string> = { model: "Model", agent: "Agent", app: "App" };

/** A text button that opens a searchable listbox of AI systems. */
export function SystemPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  useLayoutEffect(() => () => setOpen(false), []);
  const current = provider.getSystem(value);
  return (
    <P.Root open={open} onOpenChange={setOpen}>
      <P.Trigger asChild>
        <button
          type="button"
          aria-label={`AI system: ${current?.name ?? "none"}. Change`}
          className="flex h-8 max-w-full items-center gap-1 rounded-[6px] px-2 text-[13px] text-ink-2 transition-colors duration-150 hover:bg-sunken hover:text-ink data-[state=open]:bg-sunken"
        >
          <span className="truncate">{current?.name}</span>
          <ChevronDown className="size-4 shrink-0 text-ink-3" strokeWidth={1.5} />
        </button>
      </P.Trigger>
      <P.Portal>
        <P.Content
          align="start"
          sideOffset={6}
          collisionPadding={8}
          className="pop-in z-50 w-[300px] overflow-hidden rounded-[10px] border border-line bg-surface shadow-[var(--shadow-2)]"
        >
          <Command label="AI systems" loop>
            <div className="field-box border-b border-line px-3">
              <Command.Input
                placeholder="Search AI systems…"
                aria-label="Search AI systems"
                className="h-10 w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-3"
              />
            </div>
            <Command.List className="quiet-scroll max-h-[300px] overflow-y-auto p-1">
              <Command.Empty className="px-3 py-4 text-ink-2">No matching systems</Command.Empty>
              {provider.listSystems().map((s) => (
                <Command.Item
                  key={s.id}
                  value={`${s.name} ${s.kind}`}
                  onSelect={() => {
                    onChange(s.id);
                    setOpen(false);
                  }}
                  className="flex min-h-10 cursor-default items-center gap-2 rounded-[6px] px-2 py-1.5 data-[selected=true]:bg-sunken"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] text-ink">{s.name}</span>
                    <span className="block text-[12px] text-ink-3">{KIND[s.kind]}</span>
                  </span>
                  {s.id === value && <Check className="size-4 text-ink-2" strokeWidth={1.5} aria-label="Selected" />}
                </Command.Item>
              ))}
              <Command.Item
                disabled
                value="Connect an AI system"
                className="mt-1 flex min-h-10 cursor-not-allowed flex-col items-start justify-center rounded-[6px] border-t border-line px-2 py-1.5"
              >
                <span className="text-[14px] text-ink-3">Connect an AI system</span>
                <span className="text-[12px] text-ink-3">Connections are not available in the demo</span>
              </Command.Item>
            </Command.List>
          </Command>
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}
