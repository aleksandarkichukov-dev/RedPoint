"use client";

import { CaretDown } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

export interface Filter {
  id: string;
  label: string;
  /** Current selection, shown in place of the label once something is picked. */
  value?: string;
}

export interface FilterBarProps {
  filters: Filter[];
  onOpen?: (id: string) => void;
  className?: string;
}

/**
 * Text-first triggers with a chevron, divided by hairlines. Deliberately no
 * button chrome: turning these into bordered dropdown buttons is called out in
 * the design system as the wrong move, because it puts a box around every
 * control on a page whose whole point is flat rectangles.
 *
 * This is the presentational shell only. The panels themselves land in Phase 4
 * with the PLP.
 */
export function FilterBar({ filters, onOpen, className }: FilterBarProps) {
  return (
    <div
      className={cn(
        // Scrolls sideways on narrow viewports rather than wrapping into a
        // second row, which would push the product grid down the page.
        "flex items-stretch overflow-x-auto",
        "divide-x divide-border border-y border-border",
        className,
      )}
    >
      {filters.map((filter) => {
        const isSet = Boolean(filter.value);
        return (
          <button
            key={filter.id}
            type="button"
            onClick={() => onOpen?.(filter.id)}
            aria-haspopup="listbox"
            className={cn(
              "flex shrink-0 items-center gap-2 whitespace-nowrap px-4 py-3",
              "font-body text-nav text-primary",
              "transition-colors duration-(--duration-fast) hover:bg-surface",
            )}
          >
            <span className={cn(isSet && "font-semibold")}>
              {filter.value ?? filter.label}
            </span>
            <CaretDown size={12} weight="bold" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
