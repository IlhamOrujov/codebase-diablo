"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { provider } from "@/lib/data";
import { useSession } from "@/components/auth/SessionProvider";
import { Composer, type ComposerHandle } from "./Composer";
import { InvestigatorPicker } from "./InvestigatorPicker";
import { useSelectedSystem } from "./SystemPicker";

export function Home() {
  const router = useRouter();
  const session = useSession();
  const [system] = useSelectedSystem();
  const [pending, startTransition] = useTransition();
  const composer = useRef<ComposerHandle>(null);

  // Every time Home becomes visible (first visit or coming back through the
  // sidebar), the composer is empty, enabled and focused. Effects re-run when a
  // route hidden by Activity is shown again; pending comes from the navigation
  // transition, so it can never stay stuck.
  useEffect(() => {
    if (matchMedia("(pointer: fine)").matches) composer.current?.focus();
  }, []);

  return (
    <>
      {/* A broad burgundy glow rising from the floor of the page, nothing around the question. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 95% 62% at 50% 104%, rgb(122 10 46 / 0.62) 0%, rgb(97 4 34 / 0.45) 26%, rgb(87 0 26 / 0.22) 50%, rgb(87 0 26 / 0.07) 70%, transparent 85%)",
          }}
        />
        {/* Dark mode: the top and sides stay deep, so the floor glows. */}
        <div
          className="absolute inset-0 hidden dark:block"
          style={{ background: "radial-gradient(ellipse 110% 90% at 50% 100%, transparent 45%, rgb(6 2 4 / 0.6) 100%)" }}
        />
      </div>
      <div className="relative mx-auto flex min-h-full w-full max-w-[720px] flex-col px-4 pb-8 pt-[clamp(96px,34vh,380px)] sm:px-6">
        <h1 className="rise text-center text-[30px] font-semibold leading-[38px] tracking-[-0.022em] text-ink sm:text-[32px] sm:leading-[40px]">
          What do you want to find out?
        </h1>

        <Composer
          ref={composer}
          id="composer-input"
          className="rise mt-8 [--d:60ms]"
          label="Describe what you want to find out about an AI system"
          placeholder="Describe what you want to find out about an AI system…"
          pending={pending}
          onSubmit={(text) => {
            // A real workspace runs the real engine; the demo workspace keeps its labelled sample flow.
            if (session && !session.demo) {
              startTransition(() =>
                router.push(
                  `/live?q=${encodeURIComponent(text.slice(0, 400))}`,
                ),
              );
              return;
            }
            const id = provider.createInvestigation(text, system);
            startTransition(() => router.push(`/investigations/${id}`));
          }}
          left={<InvestigatorPicker />}
        />
      </div>
    </>
  );
}
