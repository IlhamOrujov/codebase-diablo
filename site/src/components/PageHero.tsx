const delay = (s: number) => ({ "--d": `${s}s` }) as React.CSSProperties;

/** The opening of every inner page. Pure CSS, so it is never blank while the page loads. */
export function PageHero({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 md:pb-24 md:pt-28">
      <p className="rise t-overline text-accent-text">{eyebrow}</p>
      <h1 className="rise t-hero mt-5 max-w-4xl text-balance" style={delay(0.06)}>
        {title}
      </h1>
      {children && (
        <p className="rise t-lead mt-7 max-w-2xl text-pretty text-ink-2" style={delay(0.14)}>
          {children}
        </p>
      )}
    </section>
  );
}
