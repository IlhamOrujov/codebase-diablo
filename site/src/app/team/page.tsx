import type { Metadata } from "next";
import { CtaBand } from "@/components/CtaBand";
import { PageHero } from "@/components/PageHero";
import { Reveal, SectionHead } from "@/components/Reveal";
import { TryButton } from "@/components/TryButton";
import { pageMetadata } from "@/lib/site";
import { TEAM } from "@/lib/team";

export const metadata: Metadata = pageMetadata({
  path: "/team",
  title: "Team",
  description: "The small team building Diablo AI, and the rules we hold ourselves to.",
});

const VALUES = [
  { title: "Measure before we claim.", body: "The rule we built into Diablo applies to us too." },
  { title: "Small, reversible steps.", body: "Every change is something we can test and undo." },
  { title: "Show the evidence.", body: "If we can’t point to it, we don’t say it." },
];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export default function TeamPage() {
  return (
    <>
      <PageHero eyebrow="Team" title="A small team with one question.">
        How do you understand an intelligence well enough to make it better? We’re building the answer.
      </PageHero>

      <section className="border-t">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-20 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
          {TEAM.map((m, i) => {
            const card = (
              <div className="flex h-full flex-col rounded-[1.75rem] border bg-surface p-7 transition-shadow duration-200 hover:shadow-2">
                <span className="grid size-16 place-items-center rounded-[1.1rem] bg-burgundy text-xl font-semibold tracking-[-0.02em] text-cream" aria-hidden>
                  {initials(m.name)}
                </span>
                <h2 className="t-headline mt-8">{m.name}</h2>
                <p className="t-callout mt-1 text-ink-3">{m.role}</p>
                <p className="t-body mt-4 flex-1 text-ink-2">{m.line}</p>
                {m.href && <p className="t-callout mt-6 font-semibold text-accent-text">Profile ↗</p>}
              </div>
            );
            return (
              <Reveal key={m.name} delay={0.06 * i} className="h-full">
                {m.href ? (
                  <a href={m.href} target="_blank" rel="noreferrer" className="press block h-full rounded-[1.75rem]">
                    {card}
                  </a>
                ) : (
                  card
                )}
              </Reveal>
            );
          })}
          <Reveal delay={0.06 * TEAM.length} className="h-full">
            <div className="flex h-full flex-col rounded-[1.75rem] border border-dashed border-line-strong p-7">
              <span className="grid size-16 place-items-center rounded-[1.1rem] border border-dashed border-line-strong text-2xl text-ink-3" aria-hidden>
                +
              </span>
              <h2 className="t-headline mt-8">You?</h2>
              <p className="t-body mt-4 flex-1 text-ink-2">
                We want people who care about measuring things properly. Run an investigation, then tell us what Diablo found.
              </p>
              <div className="mt-6">
                <TryButton size="sm" />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-t bg-subtle">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <SectionHead eyebrow="How we work" title="We hold ourselves to Diablo’s rules." />
          <div className="mt-12 grid gap-px overflow-clip rounded-[1.75rem] border bg-line md:grid-cols-3">
            {VALUES.map((v, i) => (
              <Reveal key={v.title} delay={0.05 * i} className="bg-surface p-7">
                <p className="t-caption font-mono text-accent-text">0{i + 1}</p>
                <h3 className="t-headline mt-5">{v.title}</h3>
                <p className="t-body mt-2 text-ink-2">{v.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
