"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** ⌘⇧A on a Mac, Ctrl+Shift+A elsewhere, opens /admin from anywhere in the app. */
export function AdminShortcut() {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.shiftKey || e.altKey || !(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() !== "a") return;
      e.preventDefault();
      if (window.location.pathname !== "/admin") router.push("/admin");
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [router]);
  return null;
}
