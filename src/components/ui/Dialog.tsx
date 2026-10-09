"use client";

import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { IconButton } from "./Button";

/**
 * Modal dialog (Radix): aria-modal, focus trap, Esc, scrim click and focus
 * restore are built in. `variant="sheet-right"` / `"sheet-left"` slide-free
 * side sheets for the experiment panel and the mobile drawer.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  hideTitle,
  children,
  variant = "center",
  className,
  initialFocus,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  hideTitle?: boolean;
  children: ReactNode;
  variant?: "center" | "sheet-right" | "sheet-left" | "palette";
  className?: string;
  initialFocus?: (e: Event) => void;
}) {
  // These dialogs often open from a shortcut, not a Dialog.Trigger, so Radix would return focus to <body>.
  // Remember what had focus when the dialog opened and give it back on close.
  const returnTo = useRef<HTMLElement | null>(null);
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fade-in fixed inset-0 z-50 bg-[rgb(20_14_16/0.45)]" />
        <D.Content
          onOpenAutoFocus={(e) => {
            returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            initialFocus?.(e);
          }}
          onCloseAutoFocus={(e) => {
            const el = returnTo.current;
            if (el && el.isConnected && el.offsetParent !== null) {
              e.preventDefault();
              el.focus();
            }
          }}
          aria-modal="true"
          className={cn(
            "fade-in fixed z-50 flex flex-col bg-surface text-ink outline-none",
            variant === "center" &&
              "left-1/2 top-[12vh] max-h-[76vh] w-[calc(100vw-32px)] max-w-[480px] -translate-x-1/2 rounded-[10px] border border-line shadow-[var(--shadow-3)]",
            variant === "palette" &&
              "left-1/2 top-[12vh] max-h-[70vh] w-[calc(100vw-32px)] max-w-[600px] -translate-x-1/2 overflow-hidden rounded-[10px] border border-line shadow-[var(--shadow-3)]",
            variant === "sheet-right" && "inset-y-0 right-0 w-full max-w-[560px] border-l border-line shadow-[var(--shadow-3)]",
            variant === "sheet-left" && "inset-y-0 left-0 w-[min(300px,calc(100vw-48px))] border-r border-line bg-subtle",
            className,
          )}
        >
          <D.Title className={cn(hideTitle ? "sr-only" : "px-5 pt-5 text-[16px] font-medium")}>{title}</D.Title>
          {description ? (
            <D.Description className={cn(hideTitle ? "sr-only" : "px-5 pt-1 text-ink-2")}>{description}</D.Description>
          ) : (
            <D.Description className="sr-only">{title}</D.Description>
          )}
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export function DialogClose({ label = "Close", className }: { label?: string; className?: string }) {
  return (
    <D.Close asChild>
      <IconButton label={label} icon={<X strokeWidth={1.5} />} className={className} />
    </D.Close>
  );
}

export const DialogCloseRaw = D.Close;
