"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { CategoryTile } from "@/lib/home";

/** Pointer travel, in px, past which a press counts as a drag and not a click. */
const DRAG_THRESHOLD = 8;

export interface CategoryCarouselProps {
  title: string;
  tiles: CategoryTile[];
}

/**
 * Horizontal rail of tall portrait tiles.
 *
 * Scrolling is native: `overflow-x-auto` with scroll snapping, so touch, wheel
 * and keyboard all work without a line of JavaScript. The client layer adds
 * only what native scrolling does not give a mouse user: pointer dragging, and
 * arrows that disable themselves at the ends.
 */
export function CategoryCarousel({ title, tiles }: CategoryCarouselProps) {
  const rail = useRef<HTMLUListElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef({ startX: 0, startScroll: 0, moved: 0, captured: false });

  const syncEdges = useCallback(() => {
    const node = rail.current;
    if (!node) return;
    setAtStart(node.scrollLeft <= 1);
    setAtEnd(node.scrollLeft + node.clientWidth >= node.scrollWidth - 1);
  }, []);

  useEffect(() => {
    syncEdges();
    const node = rail.current;
    if (!node) return;
    // Scroll on the rail itself, not the window, so this is a local listener
    // rather than a global one and costs nothing when the section is offscreen.
    node.addEventListener("scroll", syncEdges, { passive: true });
    const observer = new ResizeObserver(syncEdges);
    observer.observe(node);
    return () => {
      node.removeEventListener("scroll", syncEdges);
      observer.disconnect();
    };
  }, [syncEdges]);

  // No catalogue, no row. An empty carousel with a heading over it is worse
  // than the section not being there.
  if (tiles.length === 0) return null;

  const scrollByTile = (direction: 1 | -1) => {
    const node = rail.current;
    if (!node) return;
    const tile = node.querySelector("li");
    const step = tile ? tile.getBoundingClientRect().width + 16 : node.clientWidth * 0.8;
    node.scrollBy({ left: step * direction, behavior: "smooth" });
  };

  return (
    <section className="flex flex-col gap-6 py-8 md:py-16">
      <div className="mx-auto flex w-full max-w-(--container-page) items-end justify-between gap-4 px-4 md:px-8">
        <h2>{title}</h2>

        {/* Text-first controls, in the same spirit as the filter bar: a glyph
            and nothing around it. Hidden on touch, where dragging is native. */}
        <div className="hidden items-center gap-2 md:flex">
          <button
            type="button"
            onClick={() => scrollByTile(-1)}
            disabled={atStart}
            aria-label="Предишни категории"
            className="grid size-8 place-items-center transition-opacity duration-(--duration-fast) disabled:opacity-25"
          >
            <CaretLeft size={20} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => scrollByTile(1)}
            disabled={atEnd}
            aria-label="Следващи категории"
            className="grid size-8 place-items-center transition-opacity duration-(--duration-fast) disabled:opacity-25"
          >
            <CaretRight size={20} aria-hidden />
          </button>
        </div>
      </div>

      <ul
        ref={rail}
        className={cn(
          "flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth",
          /* Full-bleed rail that still lines its first tile up with the page
             gutter, so the row reads as continuing past the viewport edge.
             scroll-padding as well as padding: without it `snap-start` aligns
             tiles to the container edge and scrolls the gutter away, leaving
             the rail resting at scrollLeft 32 instead of 0. */
          "px-4 scroll-pl-4 md:px-8 md:scroll-pl-8",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          dragging && "cursor-grabbing select-none",
        )}
        onPointerDown={(event) => {
          const node = rail.current;
          if (!node) return;
          /* Reset on every press, touch included. Touch scrolls natively and
             skips the rest of this, but the click guard below still reads
             `moved`, and a stale distance from an earlier mouse drag would
             swallow the next tap. */
          drag.current = {
            startX: event.clientX,
            startScroll: node.scrollLeft,
            moved: 0,
            captured: false,
          };
          if (event.pointerType === "touch") return;
          setDragging(true);
        }}
        onPointerMove={(event) => {
          const node = rail.current;
          if (!node || !dragging) return;
          const delta = event.clientX - drag.current.startX;
          drag.current.moved = Math.abs(delta);

          /* Capture only once this is unmistakably a drag rather than a click.
             Capturing on pointerdown instead — which is the obvious place —
             makes Chrome retarget the following `click` to this <ul>, so a
             plain click on a tile never reaches the tile's link and the
             carousel silently stops navigating anywhere. */
          if (!drag.current.captured && drag.current.moved > DRAG_THRESHOLD) {
            node.setPointerCapture(event.pointerId);
            drag.current.captured = true;
          }

          node.scrollLeft = drag.current.startScroll - delta;
        }}
        onPointerUp={(event) => {
          if (drag.current.captured) {
            rail.current?.releasePointerCapture(event.pointerId);
            drag.current.captured = false;
          }
          setDragging(false);
        }}
        onPointerCancel={(event) => {
          if (drag.current.captured) {
            rail.current?.releasePointerCapture(event.pointerId);
            drag.current.captured = false;
          }
          setDragging(false);
        }}
        // A drag that ends on a tile must not also follow its link.
        onClickCapture={(event) => {
          if (drag.current.moved > DRAG_THRESHOLD) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        {tiles.map((tile) => (
          <li
            key={tile.href}
            className="w-[68vw] shrink-0 snap-start sm:w-[38vw] lg:w-[22vw] xl:w-[18rem]"
          >
            <Link href={tile.href} className="group/tile block" draggable={false}>
              {/* Same ratio as the product photography, not a taller editorial
                  crop. The tiles now show real garments, and 2:3 cut the sides
                  off them: a jacket lost its sleeves to the frame. */}
              <div className="relative aspect-[502/616] overflow-hidden bg-neutral">
                <Image
                  src={tile.image}
                  alt={tile.alt}
                  fill
                  sizes="(min-width: 1280px) 18rem, (min-width: 1024px) 22vw, (min-width: 640px) 38vw, 68vw"
                  draggable={false}
                  className="object-cover transition-opacity duration-(--duration-base) group-hover/tile:opacity-85"
                />
              </div>
              <span className="mt-3 block font-headline text-subhead font-bold text-primary uppercase">
                {tile.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
