"use client";

import * as M from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Dropdown menu (Radix): arrow keys, typeahead, Esc, outside click and focus return are built in. */
export const Menu = M.Root;
export const MenuTrigger = M.Trigger;

export function MenuContent({
  children,
  align = "start",
  side = "bottom",
  className,
  label,
}: {
  children: ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
  label?: string;
}) {
  return (
    <M.Portal>
      <M.Content
        align={align}
        side={side}
        sideOffset={6}
        collisionPadding={8}
        aria-label={label}
        className={cn(
          "pop-in z-50 min-w-[200px] rounded-[10px] border border-line bg-surface p-1 text-[14px] text-ink shadow-[var(--shadow-2)]",
          className,
        )}
      >
        {children}
      </M.Content>
    </M.Portal>
  );
}

const itemClass =
  "flex min-h-8 w-full cursor-default select-none items-center gap-2.5 rounded-[6px] px-2 text-left outline-none data-[highlighted]:bg-sunken data-[disabled]:text-ink-3 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-ink-3";

export function MenuItem({
  children,
  onSelect,
  icon,
  danger,
  disabled,
}: {
  children: ReactNode;
  onSelect?: (e: Event) => void;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <M.Item onSelect={onSelect} disabled={disabled} className={cn(itemClass, danger && "text-bad [&_svg]:text-bad")}>
      {icon}
      {children}
    </M.Item>
  );
}

/** A menu item that is a link (keeps real navigation semantics). */
export function MenuLink({ href, children, icon, external }: { href: string; children: ReactNode; icon?: ReactNode; external?: boolean }) {
  return (
    <M.Item asChild className={itemClass}>
      <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
        {icon}
        {children}
      </a>
    </M.Item>
  );
}

export function MenuSeparator() {
  return <M.Separator className="-mx-1 my-1 h-px bg-line" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <M.Label className="px-2 pb-1 pt-1.5 text-[12px] text-ink-3">{children}</M.Label>;
}
