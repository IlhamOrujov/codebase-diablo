"use client";

import * as T from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

/** A short label on hover and keyboard focus. Never the only place information lives. */
export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
}: {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
}) {
  if (!content) return <>{children}</>;
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={8}
          className="pop-in z-[60] max-w-[280px] rounded-[6px] bg-ink px-2 py-1 text-[12px] leading-[16px] text-bg"
        >
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
