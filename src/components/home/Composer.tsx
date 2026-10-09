"use client";

import { ArrowUp, Loader2 } from "lucide-react";
import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/cn";
import { MAX_QUESTION } from "@/lib/data/provider";
import { count } from "@/lib/format";
import { isComposing } from "@/lib/platform";

export interface ComposerHandle {
  focus: () => void;
  fill: (text: string) => void;
}

/**
 * The composer: one container, a growing textarea and an icon-only Send.
 * Enter sends, Shift+Enter adds a line, Enter during IME composition does
 * nothing, and Enter on an empty composer does nothing.
 */
export const Composer = forwardRef<
  ComposerHandle,
  {
    id: string;
    label: string;
    placeholder: string;
    onSubmit: (text: string) => void;
    pending?: boolean;
    left?: ReactNode;
    /** Extra actions next to Send (e.g. "Save as note"); they receive the current text. */
    extra?: (text: string, clear: () => void) => ReactNode;
    className?: string;
  }
>(function Composer({ id, label, placeholder, onSubmit, pending = false, left, extra, className }, ref) {
  const [text, setText] = useState("");
  const [slow, setSlow] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const reasonId = useId();
  const empty = text.trim().length === 0;
  const near = text.length >= MAX_QUESTION * 0.9;

  useImperativeHandle(ref, () => ({
    focus: () => area.current?.focus(),
    fill: (t: string) => {
      setText(t.slice(0, MAX_QUESTION));
      requestAnimationFrame(() => {
        const el = area.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      });
    },
  }));

  // Spinner only if sending takes longer than 300 ms.
  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => setSlow(true), 300);
    return () => {
      clearTimeout(t);
      setSlow(false);
    };
  }, [pending]);

  // JS fallback for browsers without `field-sizing: content`: grow from 2 to 10 rows.
  useEffect(() => {
    const el = area.current;
    if (!el || (typeof CSS !== "undefined" && CSS.supports("field-sizing", "content"))) return;
    el.style.height = "auto";
    const line = parseFloat(getComputedStyle(el).lineHeight) || 24;
    el.style.height = `${Math.min(Math.max(el.scrollHeight, line * 2), line * 10)}px`;
  }, [text]);

  const submit = () => {
    if (empty || pending) return;
    const value = text.trim();
    setText("");
    onSubmit(value);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className={cn("field-box rounded-[20px] border border-line bg-surface transition-colors duration-150", className)}
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <textarea
        id={id}
        ref={area}
        rows={2}
        value={text}
        maxLength={MAX_QUESTION}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || e.shiftKey || isComposing(e)) return;
          e.preventDefault();
          submit();
        }}
        className="block max-h-[calc(10*24px+16px)] min-h-[calc(2*24px+16px)] w-full resize-none overflow-y-auto bg-transparent px-4 pb-1 pt-3.5 text-[16px] leading-6 text-ink outline-none [field-sizing:content] placeholder:text-ink-3"
      />
      <div className="flex items-center gap-2 px-2.5 pb-2.5">
        <div className="min-w-0 flex-1">{left}</div>
        {near && (
          <span className="font-mono text-[12px] text-ink-3" aria-live="polite">
            {count(text.length)} / {count(MAX_QUESTION)}
          </span>
        )}
        {extra?.(text, () => setText(""))}
        <Tooltip
          content={
            <span className="flex items-center gap-2">
              Send <span className="font-mono text-bg/70">↵</span>
            </span>
          }
        >
          <button
            type="submit"
            aria-label="Send"
            aria-disabled={empty || pending || undefined}
            aria-busy={pending || undefined}
            aria-describedby={empty ? reasonId : undefined}
            data-testid="send"
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-full transition-colors duration-150",
              empty ? "cursor-not-allowed bg-sunken text-ink-3" : "bg-accent text-accent-ink hover:bg-accent-hover",
            )}
          >
            {pending && slow ? <Loader2 className="size-4 animate-spin" strokeWidth={1.5} /> : <ArrowUp className="size-4" strokeWidth={2} />}
          </button>
        </Tooltip>
        <span id={reasonId} className="sr-only">
          Type a question first
        </span>
      </div>
    </form>
  );
});
