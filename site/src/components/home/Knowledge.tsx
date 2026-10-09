import { Reveal, SectionHead } from "@/components/Reveal";

const LEARNS = [
  "Behaviours",
  "Capabilities",
  "Failure modes",
  "Causes",
  "Interventions",
  "Counterexamples",
  "Successful changes",
  "Failed experiments",
  "Open questions",
];

const ASKS = [
  "What do we actually know?",
  "What don’t we know?",
  "What are the possible causes?",
  "Which experiment would tell them apart?",
  "Did the change actually work?",
];

export function Knowledge() {
  return (
    <section className="border-t">
      <div className="mx-auto grid max-w-6xl gap-14 px-4 py-24 sm:px-6 lg:grid-cols-2">
        <div>
          <SectionHead eyebrow="Persistent understanding" title="Every investigation leaves a record.">
            Today that record is a report you can trace down to the raw outputs. Next, Diablo keeps what it learns across
            investigations, so your AI system stops being a black box.
          </SectionHead>
          <Reveal delay={0.06}>
            <p className="t-overline mt-10 text-ink-3">What it will keep</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {LEARNS.map((l) => (
                <li key={l} className="t-callout rounded-full border bg-surface px-3.5 py-2 font-medium">
                  {l}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <Reveal delay={0.1} className="grid content-start gap-4 sm:grid-cols-2">
          <div className="rounded-[1.75rem] border bg-subtle p-6">
            <p className="t-overline text-ink-3">A typical AI agent</p>
            <p className="mt-3 text-[1.75rem] font-semibold leading-tight tracking-[-0.025em] text-ink-3">“Do this task.”</p>
            <p className="t-callout mt-3 text-ink-3">Changes something right away and hopes it helped.</p>
          </div>
          <div className="rounded-[1.75rem] bg-burgundy p-6 text-cream">
            <p className="t-overline text-cream/70">Diablo</p>
            <p className="mt-3 text-[1.75rem] font-semibold leading-tight tracking-[-0.025em]">“Understand this AI.”</p>
            <p className="t-callout mt-3 text-cream/80">Asks first, then tests, then concludes.</p>
          </div>
          <div className="rounded-[1.75rem] border bg-surface p-6 sm:col-span-2">
            <p className="t-overline text-ink-3">Before any change, Diablo asks</p>
            <ol className="mt-4 space-y-2.5">
              {ASKS.map((a, i) => (
                <li key={a} className="t-body flex items-baseline gap-3">
                  <span className="t-caption font-mono text-ink-3">{i + 1}</span>
                  {a}
                </li>
              ))}
            </ol>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
