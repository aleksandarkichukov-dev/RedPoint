import Link from "next/link";

/**
 * The shell every help page shares.
 *
 * One column at reading width rather than the catalogue's full-bleed grid.
 * These pages are read, not scanned, and a line of Bulgarian body copy running
 * the width of a desktop screen is roughly 140 characters — about twice what an
 * eye tracks comfortably before losing the next line.
 */
export function HelpPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[68ch] flex-col gap-8 px-4 py-8 md:px-8 md:py-12">
      <header className="flex flex-col gap-3">
        <nav aria-label="Пътека">
          <Link href="/" className="font-body text-body text-muted-text hover:underline">
            Начало
          </Link>
        </nav>
        <h1 className="text-display">{title}</h1>
        {intro && <p className="font-body text-nav text-body-text">{intro}</p>}
      </header>
      {children}
    </div>
  );
}

/** A titled block. The heading is the thing someone is scanning for. */
export function HelpSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-6">
      <h2 className="text-subhead text-primary">{title}</h2>
      {children}
    </section>
  );
}

export function HelpText({ children }: { children: React.ReactNode }) {
  return <p className="font-body text-body text-body-text">{children}</p>;
}
