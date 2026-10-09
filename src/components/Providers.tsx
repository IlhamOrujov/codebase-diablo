"use client";

import { useEffect, type ReactNode } from "react";
import { MotionConfig } from "motion/react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useMotionPref, watchPreferences } from "@/lib/prefs";

/** App-wide client context: motion policy, tooltips and preference sync. */
export function Providers({ children }: { children: ReactNode }) {
  const motion = useMotionPref();
  useEffect(() => watchPreferences(), []);
  return (
    <MotionConfig reducedMotion={motion === "reduce" ? "always" : "user"}>
      <Tooltip.Provider delayDuration={400} skipDelayDuration={200}>
        {children}
      </Tooltip.Provider>
    </MotionConfig>
  );
}
