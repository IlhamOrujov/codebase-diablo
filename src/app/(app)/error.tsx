"use client";

import { ErrorView } from "@/components/ErrorView";

export default function Error(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorView {...props} />;
}
