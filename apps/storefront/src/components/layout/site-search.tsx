"use client";

import { MagnifyingGlass, X } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { search, type SearchResults } from "@/lib/search-actions";
import { cn } from "@/lib/cn";
import { formatEur } from "@/lib/price";

/**
 * The search panel, dropping from the header.
 *
 * A panel rather than its own page: a shopper searching is halfway through
 * looking at something else, and a full navigation throws that away for a
 * question they may answer in two words.
 *
 * Results are fetched on the server through the same matcher the chat uses, so
 * `denki`, `дънки` and a mistyped `бежав` all land in the same place.
 */
export function SiteSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  /* Debounced, because a catalogue read per keystroke is one query per letter
     and an answer that arrives out of order. 300ms is about the gap between
     words, so a finished thought searches once. */
  useEffect(() => {
    if (!open) return;
    const wanted = query.trim();

    if (wanted.length < 2) {
      setResults(null);
      return;
    }

    const timer = setTimeout(() => {
      startTransition(async () => setResults(await search(wanted)));
    }, 300);

    return () => clearTimeout(timer);
  }, [query, open]);

  const close = () => {
    setOpen(false);
    setQuery("");
    setResults(null);
  };

  const nothing =
    results !== null &&
    results.categories.length === 0 &&
    results.products.length === 0 &&
    !pending;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? "Затвори търсенето" : "Търсене"}
        aria-expanded={open}
        className="grid size-11 place-items-center text-[20px] md:size-12 md:text-[24px]"
      >
        {open ? <X aria-hidden /> : <MagnifyingGlass aria-hidden />}
      </button>

      {open && (
        <div
          className={cn(
            "absolute inset-x-0 top-full z-40 border-b border-border bg-background",
            "max-h-[min(34rem,calc(100dvh-5rem))] overflow-y-auto",
            "rp-panel-from-top",
          )}
        >
          <div className="mx-auto flex w-full max-w-(--container-page) flex-col gap-6 px-4 py-6 md:px-8">
            <label className="flex items-center gap-3 border-b border-primary pb-3">
              {/* Wrapped: Phosphor icons take no className, which is why the
                  header sizes them through the parent's font-size too. */}
              <span className="grid shrink-0 place-items-center text-primary">
                <MagnifyingGlass size={20} aria-hidden />
              </span>
              <input
                ref={input}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="дънки, риза, 17350…"
                aria-label="Търсене в магазина"
                className="min-w-0 flex-1 bg-transparent font-body text-input text-primary outline-none"
              />
            </label>

            {query.trim().length >= 2 && (
              <div aria-live="polite" className="flex flex-col gap-6">
                {pending && results === null && (
                  <p className="font-body text-body text-muted-text">Търсим…</p>
                )}

                {nothing && (
                  <p className="font-body text-body text-muted-text">
                    Нищо не съвпада с „{query.trim()}". Опитайте с друга дума или с
                    артикулния номер от етикета.
                  </p>
                )}

                {results?.byArticle && (
                  <p className="font-body text-body text-muted-text">
                    Артикул {results.products[0]?.article}
                  </p>
                )}

                {results && results.categories.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <h2 className="text-subhead text-primary">Категории</h2>
                    <ul className="flex flex-wrap gap-2">
                      {results.categories.map((category) => (
                        <li key={category.href}>
                          <Link
                            href={category.href}
                            onClick={close}
                            className="block border border-border px-3 py-1.5 font-body text-control text-primary hover:border-primary"
                          >
                            {category.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {results && results.products.length > 0 && (
                  <div className="flex flex-col gap-3">
                    {!results.byArticle && (
                      <h2 className="text-subhead text-primary">Продукти</h2>
                    )}
                    <ul className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                      {results.products.map((product) => (
                        <li key={product.href}>
                          <Link
                            href={product.href}
                            onClick={close}
                            className="flex items-start gap-3 border border-border p-2 hover:border-primary"
                          >
                            <span className="relative block size-16 shrink-0 overflow-hidden bg-neutral">
                              {product.image && (
                                <Image
                                  src={product.image}
                                  alt=""
                                  fill
                                  sizes="64px"
                                  className="object-cover"
                                />
                              )}
                            </span>
                            <span className="flex min-w-0 flex-col gap-1">
                              <span className="line-clamp-2 font-body text-body text-primary uppercase">
                                {product.title}
                              </span>
                              <span className="font-body text-price text-body-text">
                                {formatEur(product.price)}
                              </span>
                              <span className="font-body text-body text-muted-text">
                                {product.soldOut
                                  ? "изчерпан"
                                  : `размери: ${product.sizes.join(", ")}`}
                              </span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
