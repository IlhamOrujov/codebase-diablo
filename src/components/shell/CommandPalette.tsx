"use client";

import { Command } from "cmdk";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  CornerDownLeft,
  FileText,
  Keyboard,
  Monitor,
  Moon,
  PanelLeft,
  Plus,
  Settings,
  Sun,
  Zap,
  ZapOff,
} from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { StatusDot } from "@/components/ui/Status";
import { sortInvestigations, systemName, useWorkspace } from "@/lib/data";
import { investigationStatus } from "@/lib/data/derive";
import { isSidebarCollapsed, setMotionPref, setSidebarCollapsed, setThemePref, useMotionPref, useResolvedTheme } from "@/lib/prefs";
import { ui, useUI } from "@/lib/ui";
import { INVESTIGATIONS, LEGAL, LIBRARY } from "./nav";

/**
 * Command palette (Ctrl/⌘+K). cmdk gives combobox/listbox semantics and
 * ignores Enter during IME composition; the Radix dialog gives aria-modal,
 * the focus trap, Esc from anywhere and focus restore.
 */
export function CommandPalette() {
  const open = useUI((s) => s.palette);
  return (
    <Dialog open={open} onOpenChange={ui.setPalette} title="Command palette" hideTitle variant="palette">
      {open && <PaletteBody />}
    </Dialog>
  );
}

function PaletteBody() {
  const router = useRouter();
  const pathname = usePathname();
  const ws = useWorkspace();
  const theme = useResolvedTheme();
  const motion = useMotionPref();
  const [query, setQuery] = useState("");

  const run = (fn: () => void) => {
    ui.setPalette(false);
    fn();
  };
  const go = (href: string) => run(() => router.push(href));

  const item =
    "flex min-h-9 cursor-default select-none items-center gap-2.5 rounded-[6px] px-2 text-[14px] text-ink data-[selected=true]:bg-sunken [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-ink-3";
  const group =
    "px-1 pb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[12px] [&_[cmdk-group-heading]]:text-ink-3";

  return (
    <Command label="Command palette" loop className="flex min-h-0 flex-col">
      <div className="field-box flex items-center gap-2 border-b border-line px-4">
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="Search investigations, pages and actions…"
          aria-label="Search investigations, pages and actions"
          className="h-12 w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
        />
      </div>
      <Command.List className="quiet-scroll max-h-[min(60vh,440px)] overflow-y-auto py-1">
        <Command.Empty className="px-4 py-8 text-center text-ink-2">No results for “{query}”</Command.Empty>

        <Command.Group heading="Actions" className={group}>
          <Command.Item
            className={item}
            onSelect={() => run(() => (pathname === "/home" ? document.getElementById("composer-input")?.focus() : router.push("/home?new=1")))}
          >
            <Plus strokeWidth={1.5} /> New investigation
          </Command.Item>
          <Command.Item className={item} value="Switch theme" keywords={["dark", "light", "appearance"]} onSelect={() => run(() => setThemePref(theme === "dark" ? "light" : "dark"))}>
            {theme === "dark" ? <Sun strokeWidth={1.5} /> : <Moon strokeWidth={1.5} />} Switch to {theme === "dark" ? "light" : "dark"} theme
          </Command.Item>
          <Command.Item className={item} value="Toggle sidebar" onSelect={() => run(() => setSidebarCollapsed(!isSidebarCollapsed()))}>
            <PanelLeft strokeWidth={1.5} /> Toggle sidebar
          </Command.Item>
          <Command.Item className={item} value="Keyboard shortcuts" onSelect={() => run(() => ui.setShortcuts(true))}>
            <Keyboard strokeWidth={1.5} /> Keyboard shortcuts
          </Command.Item>
        </Command.Group>

        {ws.ready && ws.investigations.length > 0 && (
          <Command.Group heading="Investigations" className={group}>
            {sortInvestigations(ws.investigations).map((inv) => (
              <Command.Item
                key={inv.id}
                className={item}
                value={`${inv.title} ${systemName(inv.systemId)} ${inv.id}`}
                onSelect={() => go(`/investigations/${inv.id}`)}
              >
                <StatusDot status={investigationStatus(inv)} className="w-4 justify-center" />
                <span className="min-w-0 flex-1 truncate">{inv.title}</span>
                <span className="shrink-0 text-[13px] text-ink-3">{systemName(inv.systemId)}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        <Command.Group heading="Go to" className={group}>
          {[{ href: "/home", label: "Home", icon: CornerDownLeft }, INVESTIGATIONS, ...LIBRARY].map((n) => {
            const Icon = n.icon;
            return (
              <Command.Item key={n.href} className={item} value={`Go to ${n.label}`} onSelect={() => go(n.href)}>
                <Icon strokeWidth={1.5} /> {n.label}
              </Command.Item>
            );
          })}
        </Command.Group>

        <Command.Group heading="Settings" className={group}>
          <Command.Item className={item} value="Open settings" onSelect={() => go("/settings")}>
            <Settings strokeWidth={1.5} /> Open settings
          </Command.Item>
          <Command.Item className={item} value="Use light theme" onSelect={() => run(() => setThemePref("light"))}>
            <Sun strokeWidth={1.5} /> Use light theme
          </Command.Item>
          <Command.Item className={item} value="Use dark theme" onSelect={() => run(() => setThemePref("dark"))}>
            <Moon strokeWidth={1.5} /> Use dark theme
          </Command.Item>
          <Command.Item className={item} value="Use system theme" onSelect={() => run(() => setThemePref("system"))}>
            <Monitor strokeWidth={1.5} /> Use system theme
          </Command.Item>
          <Command.Item
            className={item}
            value={motion === "reduce" ? "Follow system motion setting" : "Reduce motion"}
            onSelect={() => run(() => setMotionPref(motion === "reduce" ? "system" : "reduce"))}
          >
            {motion === "reduce" ? <Zap strokeWidth={1.5} /> : <ZapOff strokeWidth={1.5} />}
            {motion === "reduce" ? "Follow system motion setting" : "Reduce motion"}
          </Command.Item>
          {LEGAL.map((l) => (
            <Command.Item key={l.href} className={item} value={l.label} onSelect={() => go(l.href)}>
              <FileText strokeWidth={1.5} /> {l.label}
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
    </Command>
  );
}
