"use client";

import { forwardRef, useId, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Tooltip } from "./Tooltip";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Shown before the label. 16px Lucide icon. */
  icon?: ReactNode;
  loading?: boolean;
  /** When set, the button is disabled and says why (tooltip and aria-describedby). */
  disabledReason?: string;
}

const VARIANT: Record<Variant, string> = {
  // Primary is the brand: burgundy with warm cream text (brand spec §16). One per view.
  primary:
    "bg-accent text-accent-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.1)] hover:bg-accent-hover active:scale-[0.98] aria-disabled:bg-sunken aria-disabled:text-ink-3 aria-disabled:shadow-none aria-disabled:active:scale-100",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-subtle aria-disabled:text-ink-3 aria-disabled:hover:bg-surface",
  ghost: "text-ink-2 hover:bg-sunken hover:text-ink aria-disabled:text-ink-3 aria-disabled:hover:bg-transparent",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 gap-1.5 px-2.5 text-[13px]",
  md: "h-9 gap-2 px-3 text-[14px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", icon, loading = false, disabledReason, className, children, type = "button", disabled, ...rest },
  ref,
) {
  const reasonId = useId();
  const isDisabled = disabled || loading || !!disabledReason;
  const button = (
    <button
      // Spread first so the safe defaults below always win.
      {...rest}
      ref={ref}
      type={type}
      disabled={isDisabled && !disabledReason}
      aria-disabled={isDisabled || undefined}
      aria-busy={loading || undefined}
      aria-describedby={disabledReason ? reasonId : rest["aria-describedby"]}
      onClick={isDisabled ? (e) => e.preventDefault() : rest.onClick}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-[6px] font-medium transition-[color,background-color,border-color,transform] duration-150",
        "[&_svg]:size-4 [&_svg]:shrink-0",
        VARIANT[variant],
        SIZE[size],
        isDisabled && "cursor-not-allowed",
        className,
      )}
    >
      {icon}
      {children}
      {disabledReason && (
        <span id={reasonId} className="sr-only">
          {disabledReason}
        </span>
      )}
    </button>
  );
  // A disabled control must say why. A button with a reason stays focusable so the tooltip can be read.
  return disabledReason ? <Tooltip content={disabledReason}>{button}</Tooltip> : button;
});

/** Icon-only button. The label is required: it becomes aria-label and the tooltip. */
export const IconButton = forwardRef<
  HTMLButtonElement,
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
    label: string;
    icon: ReactNode;
    hint?: string;
    tooltipSide?: "top" | "bottom" | "left" | "right";
  }
>(function IconButton({ label, icon, hint, className, type = "button", tooltipSide = "bottom", ...rest }, ref) {
  return (
    <Tooltip
      side={tooltipSide}
      content={
        <span className="flex items-center gap-2">
          {label}
          {hint && <span className="font-mono text-bg/70">{hint}</span>}
        </span>
      }
    >
      <button
        {...rest}
        ref={ref}
        type={type}
        aria-label={label}
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-[6px] text-ink-3 transition-colors duration-150 hover:bg-sunken hover:text-ink",
          "[&_svg]:size-4",
          className,
        )}
      >
        {icon}
      </button>
    </Tooltip>
  );
});
