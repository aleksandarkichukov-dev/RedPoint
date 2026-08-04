export interface ManifestoItem {
  /** The number carries the section. Kept short enough to read as a figure. */
  figure: string;
  label: string;
}

export interface ManifestoProps {
  items: ManifestoItem[];
}

/**
 * Three facts on black, set as figures rather than sentences.
 *
 * The one place on the page where the palette inverts. That is deliberate and
 * contained: it separates the editorial top of the page from the commerce
 * below it, and the band closes again before the product grid starts.
 */
export function Manifesto({ items }: ManifestoProps) {
  return (
    <section className="bg-primary text-white">
      <div className="mx-auto grid max-w-(--container-page) grid-cols-1 gap-10 px-4 py-16 md:grid-cols-3 md:gap-8 md:px-8 md:py-24">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col gap-3">
            <span className="font-headline text-[clamp(3rem,7vw,5.5rem)] leading-[0.85] font-bold tracking-[0.01em] uppercase">
              {item.figure}
            </span>
            <span className="max-w-[22ch] font-body text-nav text-white/70">{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
