"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { StatusPage } from "@/components/StatusPage";

/** "Something went wrong", a retry, and an id to quote when reporting it. */
export function ErrorView({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [id] = useState(() => error.digest ?? `c-${Math.random().toString(36).slice(2, 10)}`);
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <StatusPage
      title="Something went wrong"
      actions={
        <>
          <Button variant="primary" onClick={() => retry()}>
            Try again
          </Button>
          <a href="/home" className="inline-flex h-9 items-center rounded-[6px] border border-line-strong bg-surface px-3 font-medium text-ink hover:bg-subtle">
            Go to Home
          </a>
        </>
      }
    >
      <p>The page hit an unexpected error. Trying again usually works; your investigations are still saved in this tab.</p>
      <p className="mt-3 text-[13px] text-ink-3">
        Error id <span className="font-mono">{id}</span>
      </p>
    </StatusPage>
  );
}
