"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { MoreHorizontal, PanelLeft, Pencil, Pin, PinOff, Plus, Search, Trash2 } from "lucide-react";
import { LayoutGroup, motion } from "motion/react";
import { LiveMark } from "@/components/brand/LiveMark";
import { IconButton } from "@/components/ui/Button";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/Menu";
import { StatusDot } from "@/components/ui/Status";
import { Tooltip } from "@/components/ui/Tooltip";
import { ModKey } from "@/components/ui/primitives";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { provider, sortInvestigations, useWorkspace } from "@/lib/data";
import { investigationStatus } from "@/lib/data/derive";
import type { Investigation } from "@/lib/data/types";
import { setSidebarCollapsed, useSidebarCollapsed } from "@/lib/prefs";
import { ui } from "@/lib/ui";
import { AccountMenu, AccountMenuSkeleton } from "./AccountMenu";
import { DeleteDialog, RenameDialog } from "./InvestigationDialogs";
import { INVESTIGATIONS, isActive, PRIMARY, SECONDARY, type NavItem } from "./nav";

const RECENT_LIMIT = 12;

/**
 * Sidebar content, shared by the desktop sidebar and the mobile drawer.
 * Expanded or collapsed is decided by an attribute on <html> set before
 * first paint; labels hide through CSS, so the server HTML is already right.
 */
export function SidebarContent({ variant, onNavigate }: { variant: "desktop" | "drawer"; onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const collapsedPref = useSidebarCollapsed();
  const collapsed = variant === "desktop" && collapsedPref;
  // In the drawer, everything is always expanded.
  const exp = variant === "desktop" ? "sb-expanded" : "";
  const col = variant === "desktop" ? "sb-collapsed" : "hidden";

  const newInvestigation = () => {
    onNavigate?.();
    router.push("/home?new=1");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Brand and collapse */}
      <div className={cn("flex h-12 shrink-0 items-center gap-2 px-3", variant === "desktop" && "[html[data-sidebar=collapsed]_&]:justify-center [html[data-sidebar=collapsed]_&]:px-0")}>
        <Link
          href="/home"
          onClick={onNavigate}
          aria-label={`${BRAND.name}, home`}
          className={cn("flex min-w-0 items-center gap-2 rounded-[6px] px-1 py-1 text-ink", col === "sb-collapsed" && "[html[data-sidebar=collapsed]_&]:hidden")}
        >
          <span className="grid size-7 shrink-0 place-items-center rounded-[7px] bg-burgundy text-cream shadow-[inset_0_1px_0_rgb(255_255_255/0.12)]">
            <LiveMark size={19} track blink />
          </span>
          <span className={cn("truncate text-[14px] font-medium", exp)}>{BRAND.name}</span>
        </Link>
        {variant === "desktop" && (
          <IconButton
            className="ml-auto"
            label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            tooltipSide="right"
            icon={<PanelLeft strokeWidth={1.5} />}
            aria-expanded={!collapsed}
            onClick={() => setSidebarCollapsed(!collapsedPref)}
          />
        )}
      </div>

      <nav aria-label="Primary" className="flex min-h-0 flex-1 flex-col">
        <ul className="space-y-px px-2">
          <li>
            <Row label="New investigation" icon={<Plus strokeWidth={1.5} />} onClick={newInvestigation} collapsed={collapsed} />
          </li>
          <li>
            <Row
              label="Search"
              icon={<Search strokeWidth={1.5} />}
              onClick={() => {
                onNavigate?.();
                ui.setPalette(true);
              }}
              collapsed={collapsed}
              trailing={<ModKey k="K" className={exp} />}
            />
          </li>
        </ul>

        <LayoutGroup id={`nav-${variant}`}>
          <ul className="mt-3 space-y-px px-2" aria-label="Sections">
            {PRIMARY.map((item) => (
              <li key={item.href}>
                <NavRow
                  item={item}
                  // The workspace highlights its own row in the list below, not "Investigations".
                  active={item.href === INVESTIGATIONS.href ? pathname === item.href : isActive(pathname, item.href)}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                  variant={variant}
                />
              </li>
            ))}
          </ul>
        </LayoutGroup>

        <div className={cn("mt-4 flex min-h-0 flex-1 flex-col", exp)}>
          <Recents pathname={pathname} onNavigate={onNavigate} />
        </div>
        <div className={cn("flex-1", col)} />
        <LayoutGroup id={`nav-secondary-${variant}`}>
          <ul className="space-y-px border-t border-line px-2 py-2" aria-label="More">
            {SECONDARY.map((item) => (
              <li key={item.href}>
                <NavRow item={item} active={isActive(pathname, item.href)} collapsed={collapsed} onNavigate={onNavigate} variant={variant} />
              </li>
            ))}
          </ul>
        </LayoutGroup>
      </nav>

      <div className="shrink-0 border-t border-line p-2">
        <Suspense fallback={<AccountMenuSkeleton collapsed={collapsed} />}>
          <AccountMenu collapsed={collapsed} onNavigate={onNavigate} />
        </Suspense>
      </div>
    </div>
  );
}

const rowClass = (active: boolean) =>
  cn(
    "group relative flex h-8 w-full items-center gap-2.5 rounded-[6px] px-2 text-left text-[14px] transition-colors duration-150",
    "[&>svg]:relative [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-ink-3",
    "[html[data-sidebar=collapsed]_.sidebar_&]:justify-center [html[data-sidebar=collapsed]_.sidebar_&]:px-0",
    active ? "font-medium text-accent-text [&>svg]:text-accent-text" : "text-ink-2 hover:bg-sunken/70 hover:text-ink",
  );

/** The active row's burgundy wash glides between rows (brand spec §6: a subtle tint, not a pill). */
function ActiveWash({ id }: { id: string }) {
  return (
    <motion.span
      layoutId={id}
      aria-hidden
      transition={{ type: "spring", stiffness: 520, damping: 40, mass: 0.7 }}
      className="absolute inset-0 rounded-[6px] bg-accent-tint ring-1 ring-inset ring-accent-tint-2"
    />
  );
}

function Row({
  label,
  icon,
  onClick,
  collapsed,
  trailing,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  collapsed: boolean;
  trailing?: React.ReactNode;
}) {
  const btn = (
    <button type="button" onClick={onClick} className={rowClass(false)}>
      {icon}
      <span className="flex-1 truncate [html[data-sidebar=collapsed]_.sidebar_&]:sr-only">{label}</span>
      {trailing}
    </button>
  );
  return collapsed ? (
    <Tooltip side="right" content={label}>
      {btn}
    </Tooltip>
  ) : (
    btn
  );
}

function NavRow({
  item,
  active,
  collapsed,
  onNavigate,
  variant,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
  variant: "desktop" | "drawer";
}) {
  const Icon = item.icon;
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={rowClass(active)}
    >
      {active && <ActiveWash id={`nav-active-${variant}`} />}
      <Icon strokeWidth={active ? 2 : 1.5} />
      <span className="relative truncate [html[data-sidebar=collapsed]_.sidebar_&]:sr-only">{item.label}</span>
    </Link>
  );
  return collapsed ? (
    <Tooltip side="right" content={item.label}>
      {link}
    </Tooltip>
  ) : (
    link
  );
}

function Recents({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const ws = useWorkspace();
  const [showAll, setShowAll] = useState(false);
  const [renaming, setRenaming] = useState<Investigation | null>(null);
  const [deleting, setDeleting] = useState<Investigation | null>(null);

  const list = sortInvestigations(ws.investigations);
  const visible = showAll ? list : list.slice(0, RECENT_LIMIT);
  const pinned = visible.filter((i) => i.pinned);
  const rest = visible.filter((i) => !i.pinned);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-4 pb-1 text-[12px] text-ink-3" id="recents-label">
        Investigations
      </div>
      <div className="quiet-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {!ws.ready ? (
          <div className="space-y-2 px-2 pt-1" aria-hidden>
            {[70, 55, 80, 60].map((w) => (
              <div key={w} className="h-4 rounded-[4px] bg-sunken" style={{ width: `${w}%` }} />
            ))}
          </div>
        ) : list.length === 0 ? (
          <p className="px-2 py-1 text-[13px] text-ink-3">No investigations yet.</p>
        ) : (
          <>
            {pinned.length > 0 && <RecentGroup label="Pinned" items={pinned} {...{ pathname, onNavigate, setRenaming, setDeleting }} />}
            {rest.length > 0 && <RecentGroup label={pinned.length ? "Recent" : ""} items={rest} {...{ pathname, onNavigate, setRenaming, setDeleting }} />}
            {list.length > RECENT_LIMIT && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="mt-1 h-8 w-full rounded-[6px] px-2 text-left text-[13px] text-ink-2 hover:bg-sunken/70 hover:text-ink"
              >
                {showAll ? "Show fewer" : `Show all (${list.length})`}
              </button>
            )}
          </>
        )}
      </div>
      <RenameDialog inv={renaming} onClose={() => setRenaming(null)} />
      <DeleteDialog inv={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}

function RecentGroup({
  label,
  items,
  pathname,
  onNavigate,
  setRenaming,
  setDeleting,
}: {
  label: string;
  items: Investigation[];
  pathname: string;
  onNavigate?: () => void;
  setRenaming: (i: Investigation) => void;
  setDeleting: (i: Investigation) => void;
}) {
  return (
    <section className="mt-2 first:mt-0">
      {label && <h3 className="px-2 pb-0.5 pt-1 text-[12px] text-ink-3">{label}</h3>}
      <ul>
        {items.map((inv) => {
          const href = `/investigations/${inv.id}`;
          const active = pathname === href;
          return (
            <li key={inv.id} className="group/row relative">
              <Tooltip side="right" content={inv.title}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-8 items-center gap-2.5 rounded-[6px] pl-2 pr-8 text-[14px] transition-colors duration-150",
                    active ? "bg-accent-tint font-medium text-accent-text" : "text-ink-2 hover:bg-sunken/70 hover:text-ink",
                  )}
                >
                  <StatusDot status={investigationStatus(inv)} />
                  <span className="truncate">{inv.title}</span>
                </Link>
              </Tooltip>
              <Menu>
                <MenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Options for ${inv.title}`}
                    className="absolute right-1 top-1 grid size-6 place-items-center rounded-[4px] text-ink-3 opacity-0 transition-opacity duration-150 hover:bg-line hover:text-ink focus-visible:opacity-100 group-hover/row:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100"
                  >
                    <MoreHorizontal className="size-4" strokeWidth={1.5} />
                  </button>
                </MenuTrigger>
                <MenuContent align="start" side="right" label={`Options for ${inv.title}`}>
                  <MenuItem icon={<Pencil strokeWidth={1.5} />} onSelect={() => setRenaming(inv)}>
                    Rename
                  </MenuItem>
                  <MenuItem
                    icon={inv.pinned ? <PinOff strokeWidth={1.5} /> : <Pin strokeWidth={1.5} />}
                    onSelect={() => provider.setPinned(inv.id, !inv.pinned)}
                  >
                    {inv.pinned ? "Unpin" : "Pin"}
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem danger icon={<Trash2 strokeWidth={1.5} />} onSelect={() => setDeleting(inv)}>
                    Delete
                  </MenuItem>
                </MenuContent>
              </Menu>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
