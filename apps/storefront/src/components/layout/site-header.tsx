"use client";

import { Heart, List, Minus, Plus, ShoppingBag, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { NAV_GROUPS, type NavColumn } from "@/lib/navigation";
import { cn } from "@/lib/cn";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { Wordmark } from "@/components/layout/wordmark";
import { useWishlist } from "@/components/wishlist/wishlist-provider";
import { SiteSearch } from "@/components/layout/site-search";

export interface SiteHeaderProps {
  /** True on pages whose first section is full-bleed imagery, so the bar sits
   *  transparently on top of it until the user scrolls. */
  overlay?: boolean;
}

/**
 * The bar, and the drawer behind it.
 *
 * The hover mega menu it replaces only ever worked with a mouse, which meant
 * two navigations to maintain and the desktop one unreachable by touch. One
 * drawer, opened by one button, is the same at every width.
 */
export function SiteHeader({ overlay = false }: SiteHeaderProps) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [atTop, setAtTop] = useState(overlay);
  const [menuOpen, setMenuOpen] = useState(false);
  const { handles, ready } = useWishlist();
  const wishlistCount = ready ? handles.length : 0;

  /* IntersectionObserver on a sentinel at the top of the document rather than
     a scroll listener: the listener would fire on every frame and re-render
     the whole bar. */
  useEffect(() => {
    if (!overlay || !sentinel.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setAtTop(Boolean(entry?.isIntersecting)),
      { threshold: 0 },
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [overlay]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  const transparent = atTop && !menuOpen;

  return (
    <>
      <div ref={sentinel} aria-hidden className="h-px w-full" />

      <header
        className={cn(
          "fixed inset-x-0 top-0 z-40",
          "transition-colors duration-(--duration-base)",
          /* Fully transparent over the hero, by the client's decision. A flat
             45% black scrim was tried here and rejected as too heavy a band.

             It leaves a real contrast problem: the current hero's top strip has
             a relative luminance of 0.95, which puts white text at 1.05:1. The
             fix has to come from the photography — a campaign image that is
             dark in its top third — rather than from this file. Until then the
             wordmark drops its red disc up here, so at least what washes out is
             a whole mark and not a floating dot. */
          transparent
            ? "bg-transparent text-white"
            : "border-b border-border bg-background text-primary",
        )}
      >
        {/* Full width on purpose: the page grid is capped at 1400px, but a
            header capped with it leaves the menu button and the icons stranded
            267px inside the edges of a wide screen, reading as a centred
            cluster rather than as a bar. The chrome belongs in the corners. */}
        <div className="relative flex h-16 w-full items-center justify-between gap-6 px-4 md:h-20 md:px-8">
          <button
            type="button"
            aria-label="Отвори менюто"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            /* The glyph grows with the breakpoint. Phosphor icons default to
               1em and take no className, so the size travels through the
               button's own font-size. */
            className="-ml-2.5 grid size-11 place-items-center text-[22px] md:size-12 md:text-[26px]"
          >
            <List aria-hidden />
          </button>

          {/* Left on a phone, centred from `md` up.
              A 375px bar cannot hold a menu button, three icons and a centred
              mark without the mark running into the search glyph — measured at
              21px of overlap. Beside the button it has room, and the icons
              still hold the opposite corner.
              From `md` it is centred against the bar itself rather than by
              flex, so it stays put however many icons sit either side. */}
          <Link
            href="/"
            aria-label="Red Point, начална страница"
            /* py-2.5 makes the wordmark a 44px target instead of a 25px one.
               The negative margin keeps the bar the height it was — the
               padding is there for the thumb, not for the layout. */
            className="-my-2.5 mr-auto py-2.5 md:absolute md:left-1/2 md:mr-0 md:-translate-x-1/2"
          >
            {/* No disc while the bar is transparent — see Wordmark.
                Smaller on phones: the bar carries a menu button and three
                icons, and at 28px the mark runs straight into the search
                glyph on a 375px screen. */}
            <Wordmark className="text-[1.375rem] md:text-[1.75rem]" disc={!transparent} />
          </Link>

          <div className="-mr-2.5 flex items-center">
            <SiteSearch />
            <Link
              href="/wishlist"
              aria-label={
                wishlistCount > 0 ? `Любими, ${wishlistCount} артикула` : "Любими"
              }
              className="relative grid size-11 place-items-center text-[20px] md:size-12 md:text-[24px]"
            >
              {/* The glyph fills when the list has something in it. That is the
                  signal doing the work — legible at a glance and at any size,
                  where a two-digit number in a corner is not. */}
              <Heart weight={wishlistCount > 0 ? "fill" : "regular"} aria-hidden />

              {/* A bare numeral, not a filled block. The bar is transparent
                  over the hero, so a black chip would be a square floating on
                  the photograph; built from currentColor the count inverts with
                  the bar for free.

                  It also sits clear of the glyph rather than on top of it — the
                  chip overlapped the heart's upper lobe and both read as
                  smudged. Only once storage has been read: the server has no
                  localStorage, and a number rendered before then would
                  contradict the HTML it was sent. */}
              {wishlistCount > 0 && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute top-1 right-1 font-body text-[0.5625rem] leading-none font-semibold tabular-nums md:top-1.5 md:right-1.5 md:text-[0.625rem]"
                >
                  {wishlistCount > 9 ? "9+" : wishlistCount}
                </span>
              )}
            </Link>
            <Link
              href="/cart"
              aria-label="Количка"
              className="grid size-11 place-items-center text-[20px] md:size-12 md:text-[24px]"
            >
              <ShoppingBag aria-hidden />
            </Link>
          </div>
        </div>
      </header>

      {menuOpen && <NavDrawer onClose={() => setMenuOpen(false)} />}
    </>
  );
}

function NavDrawer({ onClose }: { onClose: () => void }) {
  // A drawer over the page is a modal surface: without this, Tab walks straight
  // out of it and into the page it is covering.
  const panel = useFocusTrap<HTMLDivElement>(true);
  const [openKey, setOpenKey] = useState<string | null>(null);

  /* Flattened across groups so this keeps working if the shop ever adds a
     second one. Today there is only "Мъже", and its four column headings are
     the four categories the drawer lists. */
  const categories = NAV_GROUPS.flatMap((group) => group.columns);

  return (
    <div className="fixed inset-0 z-50">
      {/* Flat fill, hard edge, no blur — the system has no shadows to spend. */}
      <button
        type="button"
        aria-label="Затвори менюто"
        tabIndex={-1}
        onClick={onClose}
        className="rp-overlay-scrim absolute inset-0 bg-primary/40"
      />

      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Меню"
        className="rp-drawer absolute inset-y-0 left-0 flex w-[min(23rem,88vw)] flex-col bg-background text-primary"
      >
        {/* Same height as the bar it drops out of, so the two line up. */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4 md:h-20">
          <Wordmark className="text-[1.5rem]" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Затвори менюто"
            className="-mr-2.5 grid size-12 place-items-center"
          >
            <X size={26} aria-hidden />
          </button>
        </div>

        <nav aria-label="Основна навигация" className="flex-1 overflow-y-auto">
          {categories.map((category, index) => (
            <AccordionRow
              key={category.label}
              category={category}
              index={index}
              open={openKey === category.label}
              onToggle={() =>
                setOpenKey((current) => (current === category.label ? null : category.label))
              }
              onNavigate={onClose}
            />
          ))}
        </nav>
      </div>
    </div>
  );
}

function AccordionRow({
  category,
  index,
  open,
  onToggle,
  onNavigate,
}: {
  category: NavColumn;
  index: number;
  open: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  const panelId = useId();

  return (
    <div
      className="rp-drawer-row border-b border-border/40"
      style={{ "--rp-stagger": `${60 + index * 45}ms` } as React.CSSProperties}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="group/row flex w-full items-center justify-between gap-4 px-4 py-5 text-left transition-colors duration-(--duration-fast) hover:text-accent"
      >
        <span className="font-headline text-subhead tracking-[0.08em] uppercase">
          {category.label}
        </span>
        {/* Plus to minus, not a rotating chevron: the sign says what the row
            will do, and a 45-degree spin into an x says something else. */}
        {open ? <Minus size={18} aria-hidden /> : <Plus size={18} aria-hidden />}
      </button>

      {/* 0fr to 1fr animates to the content's own height without measuring it
          in JavaScript, which is what a max-height guess would come down to. */}
      <div
        id={panelId}
        className={cn(
          "grid transition-[grid-template-rows] duration-(--duration-base) ease-(--ease-brand)",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <ul className="overflow-hidden">
          {category.links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={onNavigate}
                tabIndex={open ? undefined : -1}
                className="group/link block py-2.5 pr-4 pl-8 font-body text-nav transition-colors duration-(--duration-fast) hover:text-accent"
              >
                {/* The word itself is the hover state — it steps up in size and
                    weight under the pointer, instead of a marker appearing
                    beside it.

                    Scaled by transform rather than font-size, and anchored at
                    its left edge: font-size would re-measure the row, nudging
                    every line below it down by a pixel and making the whole
                    list twitch as the pointer travels. */}
                {/* `scale`, not `transform`: Tailwind v4 compiles scale-110 to
                    the standalone `scale` property, so listing `transform` here
                    leaves the size jumping instead of easing. */}
                <span className="block origin-left transition-[scale,font-weight] duration-(--duration-fast) group-hover/link:scale-110 group-hover/link:font-semibold">
                  {link.label}
                </span>
              </Link>
            </li>
          ))}

          <li>
            <Link
              href={category.href}
              onClick={onNavigate}
              tabIndex={open ? undefined : -1}
              className="mb-3 block py-2.5 pr-4 pl-8 font-body text-control lowercase underline underline-offset-4 transition-colors duration-(--duration-fast) hover:text-accent"
            >
              виж всички
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
