"use client";

import * as M from "@radix-ui/react-dropdown-menu";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useState } from "react";
import { FileText, Keyboard, LifeBuoy, LogOut, Settings } from "lucide-react";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/Menu";
import { Tooltip } from "@/components/ui/Tooltip";
import { signOut, useSession } from "@/components/auth/SessionProvider";
import { BRAND, isPlaceholder } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { provider } from "@/lib/data";
import { setThemePref, useThemePref, type ThemePref } from "@/lib/prefs";
import { ui } from "@/lib/ui";
import { LEGAL } from "./nav";

const THEMES: { value: ThemePref; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export function AccountMenu({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const session = useSession();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const theme = useThemePref();
  const [open, setOpen] = useState(false);
  // A transient menu must not reappear open when a hidden route comes back (Activity).
  useLayoutEffect(() => () => setOpen(false), []);

  if (!session) return <AccountMenuSkeleton collapsed={collapsed} />;
  const detail = session.demo ? "Demo" : (session.user.email ?? session.workspace);

  const go = (href: string) => {
    onNavigate?.();
    router.push(href);
  };

  const trigger = (
    <MenuTrigger asChild>
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-2.5 rounded-[6px] p-1.5 text-left transition-colors duration-150 hover:bg-sunken/70 data-[state=open]:bg-sunken",
          collapsed && "justify-center",
        )}
        aria-label={`Account: ${session.user.name}, ${detail}`}
      >
        <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-sunken text-[12px] font-medium text-ink-2">
          {session.user.initials}
        </span>
        <span className="sb-expanded min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[14px] text-ink">{session.user.name}</span>
          <span className="block truncate text-[12px] text-ink-3">
            {detail}
            {session.demo && provider.kind === "mock" && <> · {provider.label}</>}
          </span>
        </span>
      </button>
    </MenuTrigger>
  );

  return (
    <Menu open={open} onOpenChange={setOpen}>
      {collapsed ? (
        <Tooltip side="right" content={session.user.name}>
          {trigger}
        </Tooltip>
      ) : (
        trigger
      )}
      <MenuContent side="top" align="start" className="w-[240px]" label="Account">
        <MenuLabel>
          <span className="block truncate text-ink">{session.user.name}</span>
          <span className="block truncate">{session.demo ? "Demo session" : session.user.email}</span>
        </MenuLabel>
        <MenuItem icon={<Settings strokeWidth={1.5} />} onSelect={() => go("/settings")}>
          Settings
        </MenuItem>
        <M.Group className="px-2 py-1.5">
          <div className="pb-1.5 text-[12px] text-ink-3" id="appearance-label">
            Appearance
          </div>
          <M.RadioGroup
            value={theme}
            onValueChange={(v) => setThemePref(v as ThemePref)}
            aria-labelledby="appearance-label"
            className="flex rounded-[6px] bg-sunken p-0.5"
          >
            {THEMES.map((t) => (
              <M.RadioItem
                key={t.value}
                value={t.value}
                onSelect={(e) => e.preventDefault()}
                className="flex h-7 flex-1 cursor-default items-center justify-center rounded-[5px] text-[13px] text-ink-2 outline-none data-[highlighted]:text-ink data-[highlighted]:outline data-[highlighted]:outline-2 data-[highlighted]:outline-offset-[-2px] data-[highlighted]:outline-[var(--accent-text)] data-[state=checked]:bg-surface data-[state=checked]:font-medium data-[state=checked]:text-ink"
              >
                {t.label}
              </M.RadioItem>
            ))}
          </M.RadioGroup>
        </M.Group>
        <MenuItem icon={<Keyboard strokeWidth={1.5} />} onSelect={() => ui.setShortcuts(true)}>
          Keyboard shortcuts
        </MenuItem>
        {!isPlaceholder(BRAND.contactEmail) && (
          <MenuItem icon={<LifeBuoy strokeWidth={1.5} />} onSelect={() => window.open(`mailto:${BRAND.contactEmail}`)}>
            Help and feedback
          </MenuItem>
        )}
        <MenuSeparator />
        {LEGAL.map((l) => (
          <MenuItem key={l.href} icon={<FileText strokeWidth={1.5} />} onSelect={() => go(l.href)}>
            {l.label}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem
          icon={<LogOut strokeWidth={1.5} />}
          disabled={leaving}
          onSelect={() => {
            setLeaving(true);
            onNavigate?.();
            void signOut();
          }}
        >
          Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

/** Same footprint as the trigger, shown while the session streams in. */
export function AccountMenuSkeleton({ collapsed }: { collapsed: boolean }) {
  return (
    <div aria-hidden className={cn("flex w-full items-center gap-2.5 p-1.5", collapsed && "justify-center")}>
      <span className="size-7 shrink-0 rounded-full bg-sunken" />
      <span className="sb-expanded min-w-0 flex-1 space-y-1.5">
        <span className="block h-3 w-24 rounded bg-sunken" />
        <span className="block h-2.5 w-16 rounded bg-sunken" />
      </span>
    </div>
  );
}
