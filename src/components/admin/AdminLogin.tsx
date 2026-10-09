"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/pages/Library";

export function AdminLogin({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(configured ? null : "ADMIN_PASSWORD is not set on the server.");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password || pending) return;
    setPending(true);
    setError(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    setPending(false);
    if (res?.ok) {
      setPassword("");
      router.refresh();
      return;
    }
    const body = (await res?.json().catch(() => null)) as { message?: string } | null;
    setError(body?.message ?? "Could not reach the server.");
  };

  return (
    <div className="mx-auto max-w-[380px] pt-[12vh]">
      <PageHeader title="Admin" sub="Enter the admin password." />
      <form onSubmit={submit} className="mt-6 space-y-3">
        <label className="block">
          <span className="sr-only">Admin password</span>
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="field-box h-10 w-full rounded-[8px] border border-line-field bg-surface px-3 text-[14px] text-ink outline-none focus:border-accent-text"
          />
        </label>
        {error && (
          <p role="alert" className="text-[13px] text-bad">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" loading={pending} className="w-full justify-center">
          Unlock
        </Button>
      </form>
    </div>
  );
}
