"use client";

import { CaretDown, X } from "@phosphor-icons/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export interface FilterFacet {
  /** Query-string key: `size`, `color`, `sort`. */
  param: string;
  label: string;
  /** Already in the order they should be shown: sizes small to large, colours
   *  alphabetical. The panel never re-sorts them. */
  options: { value: string; label: string; count?: number; swatch?: string }[];
  /** Single-choice facets replace, multi-choice toggle. */
  multiple?: boolean;
}

/** Panel width, and the offset maths below, in one place. */
const PANEL_WIDTH = 260;

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
  const [panelLeft, setPanelLeft] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  const triggers = useRef(new Map<string, HTMLButtonElement>());

  /* The panel hangs under the trigger that opened it, so it reads as that
     filter's own column rather than a slab under the whole bar. It cannot live
     inside the row: the row scrolls sideways on narrow screens, and an overflow
     container clips its children in both directions. So it is a sibling, placed
     by measurement. */
  const openPanel = (param: string) => {
    const trigger = triggers.current.get(param);
    const box = container.current;
    if (trigger && box) {
      const offset = trigger.getBoundingClientRect().left - box.getBoundingClientRect().left;
      setPanelLeft(Math.max(0, Math.min(offset, box.clientWidth - PANEL_WIDTH)));
    }
    setOpen(param);
  };

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
                ref={(node) => {
                  if (node) triggers.current.set(facet.param, node);
                  else triggers.current.delete(facet.param);
                }}
                onClick={() => (isOpen ? setOpen(null) : openPanel(facet.param))}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                className="group/facet flex shrink-0 items-center px-4 py-3 font-body text-nav whitespace-nowrap text-primary"
              >
                {/* The label grows and thickens under the pointer, the same
                    gesture the drawer uses, instead of a panel of background
                    colour appearing behind it — this bar is meant to be text
                    and a chevron, with no button chrome.

                    Label and chevron scale together from the left edge so they
                    keep their spacing, and because `scale` moves nothing in the
                    layout the neighbouring triggers and the hairlines between
                    them stay exactly where they are. */}
                <span
                  className={cn(
                    "flex origin-left items-center gap-2",
                    "transition-[scale,font-weight] duration-(--duration-fast)",
                    "group-hover/facet:scale-108 group-hover/facet:font-semibold",
                    chosen.length > 0 && "font-semibold",
                  )}
                >
                  {chosen.length > 0 ? `${facet.label}: ${chosen.join(", ")}` : facet.label}
                  <CaretDown size={12} weight="bold" aria-hidden />
                </span>
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
            style={{ left: panelLeft, width: PANEL_WIDTH }}
            className="rp-panel-unfold absolute top-full z-30 max-h-96 overflow-y-auto border-x border-b border-border bg-background"
          >
            {/* Hairlines between the rows, which is the only divider this
                system has, and a hard bar marking the chosen one. No grey
                hover fill: the row answers the pointer the same way every
                other list on the site does, by growing and thickening. */}
            <ul className="flex flex-col divide-y divide-border/25">
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
                        "group/option relative flex w-full items-center gap-3 py-3 pr-4 pl-5 text-left font-body text-nav",
                        active ? "text-primary" : "text-body-text",
                      )}
                    >
                      {/* Chosen rows carry a stamped edge rather than a tint,
                          so the state survives being read in greyscale. */}
                      <span
                        aria-hidden
                        className={cn(
                          "absolute inset-y-0 left-0 w-[3px] origin-left bg-primary",
                          "transition-transform duration-(--duration-fast)",
                          active ? "scale-x-100" : "scale-x-0",
                        )}
                      />

                      {option.swatch && (
                        <span
                          aria-hidden
                          className="block size-4 shrink-0 border border-border"
                          style={{ backgroundColor: option.swatch }}
                        />
                      )}

                      <span
                        className={cn(
                          "flex-1 origin-left transition-[scale,font-weight] duration-(--duration-fast)",
                          "group-hover/option:scale-105 group-hover/option:font-semibold",
                          active ? "font-bold" : "font-medium",
                        )}
                      >
                        {option.label}
                      </span>

                      {option.count !== undefined && (
                        <span className="font-body text-body font-normal text-muted-text tabular-nums">
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
