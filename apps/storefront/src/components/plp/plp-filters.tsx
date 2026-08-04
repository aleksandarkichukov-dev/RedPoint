"use client";

import { CaretDown, X } from "@phosphor-icons/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export interface FilterFacet {
  /** Query-string key: `size`, `color`, `sort`. */
  param: string;
  label: string;
  options: { value: string; label: string; count?: number }[];
  /** Single-choice facets replace, multi-choice toggle. */
  multiple?: boolean;
}

export interface PlpFiltersProps {
  facets: FilterFacet[];
}

/**
 * Text triggers with a chevron, divided by hairlines, exactly as the design
 * system requires and deliberately not bordered dropdown buttons.
 *
 * Every choice is a URL change, so a filtered listing is shareable and the back
 * button undoes one filter at a time. Changing a filter also resets to page 1,
 * because staying on page 4 of a result set that no longer has four pages is
 * how a blank screen happens.
 */
export function PlpFilters({ facets }: PlpFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState<string | null>(null);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const selected = (param: string) => searchParams.getAll(param);

  const apply = (param: string, value: string, multiple: boolean) => {
    const next = new URLSearchParams(searchParams.toString());
    const current = next.getAll(param);

    if (multiple) {
      next.delete(param);
      const toggled = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];
      for (const item of toggled) next.append(param, item);
    } else if (current[0] === value) {
      next.delete(param);
    } else {
      next.set(param, value);
    }

    next.delete("page");
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const activeCount = facets.reduce(
    (total, facet) => total + selected(facet.param).length,
    0,
  );

  return (
    <div ref={container} className="relative">
      <div className="flex items-stretch border-y border-border">
        <div className="flex flex-1 items-stretch divide-x divide-border overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {facets.map((facet) => {
            const chosen = selected(facet.param);
            const isOpen = open === facet.param;
            return (
              <button
                key={facet.param}
                type="button"
                onClick={() => setOpen(isOpen ? null : facet.param)}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                className="flex shrink-0 items-center gap-2 px-4 py-3 font-body text-nav whitespace-nowrap text-primary transition-colors duration-(--duration-fast) hover:bg-surface"
              >
                <span className={cn(chosen.length > 0 && "font-semibold")}>
                  {chosen.length > 0 ? `${facet.label}: ${chosen.join(", ")}` : facet.label}
                </span>
                <CaretDown size={12} weight="bold" aria-hidden />
              </button>
            );
          })}
        </div>

        {activeCount > 0 && (
          <button
            type="button"
            onClick={() => router.push(pathname, { scroll: false })}
            className="flex shrink-0 items-center gap-1.5 border-l border-border px-4 py-3 font-body text-nav lowercase text-muted-text hover:text-primary"
          >
            <X size={12} weight="bold" aria-hidden />
            изчисти
          </button>
        )}
      </div>

      {facets.map((facet) => {
        if (open !== facet.param) return null;
        const chosen = selected(facet.param);
        return (
          <div
            key={facet.param}
            role="listbox"
            aria-label={facet.label}
            className="rp-panel-from-top absolute inset-x-0 top-full z-30 max-h-80 overflow-y-auto border-b border-border bg-background"
          >
            <ul className="grid grid-cols-2 gap-x-6 p-4 sm:grid-cols-3 lg:grid-cols-5">
              {facet.options.map((option) => {
                const active = chosen.includes(option.value);
                return (
                  <li key={option.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => apply(facet.param, option.value, facet.multiple ?? false)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 py-2 text-left font-body text-nav",
                        active ? "font-semibold text-primary" : "text-body-text",
                      )}
                    >
                      <span>{option.label}</span>
                      {option.count !== undefined && (
                        <span className="font-body text-body text-muted-text">
                          {option.count}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
