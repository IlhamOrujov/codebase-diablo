"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { provider } from "@/lib/data";
import type { Investigation } from "@/lib/data/types";
import { toast } from "@/lib/ui";

export function RenameDialog({ inv, onClose }: { inv: Investigation | null; onClose: () => void }) {
  return (
    <Dialog open={!!inv} onOpenChange={(v) => !v && onClose()} title="Rename investigation">
      {inv && <RenameForm key={inv.id} inv={inv} onClose={onClose} />}
    </Dialog>
  );
}

function RenameForm({ inv, onClose }: { inv: Investigation; onClose: () => void }) {
  const [title, setTitle] = useState(inv.title);
  return (
    <form
      className="p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        provider.rename(inv.id, title);
        onClose();
      }}
    >
      <label htmlFor="rename-input" className="text-[13px] text-ink-2">
        Title
      </label>
      <div className="field-box mt-1 rounded-[6px] border border-line-field bg-surface px-2.5">
        <input
          id="rename-input"
          autoFocus
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          className="h-9 w-full bg-transparent text-[14px] text-ink outline-none"
        />
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabledReason={title.trim() ? undefined : "A title can't be empty"}>
          Rename
        </Button>
      </div>
    </form>
  );
}

export function DeleteDialog({ inv, onClose }: { inv: Investigation | null; onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <Dialog
      open={!!inv}
      onOpenChange={(v) => !v && onClose()}
      title="Delete investigation?"
      description={inv ? `“${inv.title}” and its experiments and evidence will be removed from this browser.` : undefined}
    >
      <div className="flex justify-end gap-2 p-5">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            if (!inv) return;
            const here = pathname === `/investigations/${inv.id}`;
            provider.remove(inv.id);
            toast({ title: "Investigation deleted", body: inv.title });
            onClose();
            if (here) router.push("/home");
          }}
        >
          Delete
        </Button>
      </div>
    </Dialog>
  );
}
