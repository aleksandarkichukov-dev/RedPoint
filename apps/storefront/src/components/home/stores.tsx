import { ArrowUpRight, Clock, Phone } from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import type { Store } from "@/lib/home";

export interface StoresProps {
  title: string;
  stores: Store[];
}

/**
 * The three Varna shops.
 *
 * Laid out as a list beside a single image rather than as three tiles, so it
 * does not read as a repeat of the manifesto band further up the page. The
 * addresses, phones and hours come from the old site's structured data, and
 * the same record feeds the chatbot in Phase 8.
 */
export function Stores({ title, stores }: StoresProps) {
  return (
    <section className="mx-auto flex w-full max-w-(--container-page) flex-col gap-8 px-4 py-8 md:px-8 md:py-16">
      <h2>{title}</h2>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-12">
        <ul className="divide-y divide-border border-y border-border">
          {stores.map((store) => (
            <li key={store.name}>
              <a
                href={store.mapsUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="group/store flex items-start justify-between gap-4 py-5 transition-colors duration-(--duration-fast) hover:bg-surface"
              >
                <div className="flex flex-col gap-2">
                  <span className="font-headline text-subhead font-bold text-primary uppercase">
                    {store.name}
                  </span>
                  <span className="font-body text-body text-body-text">{store.address}</span>
                  <span className="flex flex-wrap items-center gap-x-4 gap-y-1 font-body text-body text-muted-text">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock size={14} aria-hidden />
                      {store.hours}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Phone size={14} aria-hidden />
                      {store.phone}
                    </span>
                  </span>
                </div>
                {/* Wrapped rather than styled directly: the SSR build of
                    Phosphor types its icons without a className prop. */}
                <span
                  aria-hidden
                  className="mt-1 shrink-0 text-primary transition-transform duration-(--duration-fast) group-hover/store:-translate-y-0.5 group-hover/store:translate-x-0.5"
                >
                  <ArrowUpRight size={18} />
                </span>
                <span className="sr-only">Отвори в Google Maps</span>
              </a>
            </li>
          ))}
        </ul>

        <div className="relative aspect-[4/3] overflow-hidden bg-neutral lg:aspect-auto lg:min-h-[26rem]">
          <Image
            src="https://picsum.photos/seed/redpoint-store-varna/1200/900"
            alt="Магазин Red Point във Варна"
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
      </div>
    </section>
  );
}
