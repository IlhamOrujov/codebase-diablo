"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * Replaces the root layout when it fails, so it brings its own document,
 * styles and theme (read from the same preference the boot script uses).
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
    let theme = "light";
    try {
      const t = localStorage.getItem("diablo.theme");
      theme = t === "light" || t === "dark" ? t : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch {}
    document.documentElement.setAttribute("data-theme", theme);
  }, [error]);
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh">
        <title>Something went wrong</title>
        <main className="grid min-h-dvh place-items-center bg-bg px-4 py-16 font-sans text-ink">
          <div className="w-full max-w-[440px] text-center">
            <h1 className="text-[30px] font-semibold leading-[38px] tracking-[-0.02em]">Something went wrong</h1>
            <p className="mt-3 text-ink-2">The app could not load. Trying again usually works.</p>
            <p className="mt-3 text-[13px] text-ink-3">
              Error id <span className="font-mono">{error.digest ?? "client"}</span>
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <button type="button" onClick={() => retry()} className="inline-flex h-9 items-center rounded-[6px] bg-ink px-3 font-medium text-bg">
                Try again
              </button>
              <a href="/home" className="inline-flex h-9 items-center rounded-[6px] border border-line-strong px-3 font-medium text-ink">
                Go to Home
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
