"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function AdminSignOut() {
  const router = useRouter();
  return (
    <Button
      size="sm"
      onClick={async () => {
        await fetch("/api/admin/logout", { method: "POST" }).catch(() => null);
        router.refresh();
      }}
    >
      Lock
    </Button>
  );
}
