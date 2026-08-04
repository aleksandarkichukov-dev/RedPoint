"use client";

import { Heart, List, MagnifyingGlass, ShoppingBag, X } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { NAV_GROUPS, SALE_LINK, type NavGroup } from "@/lib/navigation";
import { cn } from "@/lib/cn";
import { useFocusTrap } from "@/lib/use-focus-trap";

export interface SiteHeaderProps {
  /** True on pages whose first section is full-bleed imagery, so the bar sits
   *  transparently on top of it until the user scrolls. */
  overlay?: boolean;
}

export function SiteHeader({ overlay = false }: SiteHeaderProps) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [atTop, setAtTop] = useState(overlay);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

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
    if (!openGroup && !mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenGroup(null);
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openGroup, mobileOpen]);

  // Solid whenever the menu is open, otherwise the panel would float over the
  // hero with nothing behind its text.
  const transparent = atTop && !openGroup && !mobileOpen;

  return (
    <>
      <div ref={sentinel} aria-hidden className="h-px w-full" />

      <header
        className={cn(
          "fixed inset-x-0 top-0 z-40",
          "transition-colors duration-(--duration-base)",
          transparent
            ? "bg-transparent text-white"
            : "border-b border-border bg-background text-primary",
        )}
        onMouseLeave={() => setOpenGroup(null)}
      >
        <div className="mx-auto flex h-14 max-w-(--container-page) items-center justify-between gap-6 px-4 md:h-16 md:px-8">
          <button
            type="button"
            aria-label={mobileOpen ? "Затвори менюто" : "Отвори менюто"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
            className="-ml-2 grid size-11 place-items-center lg:hidden"
          >
            <List size={22} aria-hidden />
          </button>

          <Link
            href="/"
            className="font-headline text-[1.375rem] leading-none font-bold tracking-[0.06em] uppercase lg:order-first"
          >
            Red Point
          </Link>

          <nav aria-label="Основна навигация" className="hidden lg:flex lg:items-center lg:gap-8">
            {NAV_GROUPS.map((group) => (
              <Link
                key={group.label}
                href={group.href}
                onMouseEnter={() => setOpenGroup(group.label)}
                onFocus={() => setOpenGroup(group.label)}
                aria-expanded={openGroup === group.label}
                className={cn(
                  "font-body text-nav uppercase",
                  "border-b-2 border-transparent py-1 transition-colors duration-(--duration-fast)",
                  openGroup === group.label && "border-current",
                )}
              >
                {group.label}
              </Link>
            ))}
            <Link
              href={SALE_LINK.href}
              onMouseEnter={() => setOpenGroup(null)}
              onFocus={() => setOpenGroup(null)}
              className={cn(
                "font-body text-nav uppercase",
                "border-b-2 border-transparent py-1 transition-colors duration-(--duration-fast)",
                // The one place in the navigation where the accent is allowed,
                // because it is genuinely sale signage.
                transparent ? "text-white" : "text-accent",
              )}
            >
              {SALE_LINK.label}
            </Link>
          </nav>

          <div className="-mr-2 flex items-center">
            <button type="button" aria-label="Търсене" className="grid size-11 place-items-center">
              <MagnifyingGlass size={20} aria-hidden />
            </button>
            <Link href="/wishlist" aria-label="Любими" className="grid size-11 place-items-center">
              <Heart size={20} aria-hidden />
            </Link>
            <Link href="/cart" aria-label="Количка" className="grid size-11 place-items-center">
              <ShoppingBag size={20} aria-hidden />
            </Link>
          </div>
        </div>

        {NAV_GROUPS.map((group) => (
          <MegaMenu key={group.label} group={group} open={openGroup === group.label} />
        ))}
      </header>

      {mobileOpen && <MobileMenu onClose={() => setMobileOpen(false)} />}
    </>
  );
}

function MegaMenu({ group, open }: { group: NavGroup; open: boolean }) {
  if (!open) return null;
  return (
    <div className="hidden border-t border-border bg-background text-primary lg:block">
      <div className="mx-auto grid max-w-(--container-page) grid-cols-[repeat(4,1fr)_20rem] gap-8 px-8 py-8">
        {group.columns.map((column) => (
          <div key={column.label} className="flex flex-col gap-3">
            <Link href={column.href} className="font-body text-subhead text-border">
              {column.label}
            </Link>
            <ul className="flex flex-col gap-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="font-body text-nav hover:underline">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {group.feature && (
          <Link href={group.feature.href} className="group/feature col-start-5 block">
            <div className="relative aspect-[3/4] overflow-hidden bg-neutral">
              <Image
                src={group.feature.src}
                alt={group.feature.alt}
                fill
                sizes="20rem"
                className="object-cover transition-opacity duration-(--duration-base) group-hover/feature:opacity-90"
              />
            </div>
            <span className="mt-2 block font-body text-nav lowercase">{group.feature.label}</span>
          </Link>
        )}
      </div>
    </div>
  );
}

function MobileMenu({ onClose }: { onClose: () => void }) {
  // Full-screen navigation is a modal surface: without this, Tab walks straight
  // out of it and into the page it is covering.
  const panel = useFocusTrap<HTMLDivElement>(true);
  return (
    <div
      ref={panel}
      role="dialog"
      aria-modal="true"
      aria-label="Меню"
      className="fixed inset-0 z-50 flex flex-col bg-background text-primary lg:hidden"
    >
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <span className="font-headline text-[1.375rem] leading-none font-bold tracking-[0.06em] uppercase">
          Red Point
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Затвори менюто"
          className="grid size-11 place-items-center"
        >
          <X size={22} aria-hidden />
        </button>
      </div>

      <nav aria-label="Основна навигация" className="flex-1 overflow-y-auto px-4 py-6">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-8">
            <Link
              href={group.href}
              onClick={onClose}
              className="font-headline text-display block uppercase"
            >
              {group.label}
            </Link>
            <ul className="mt-3 flex flex-col gap-2">
              {group.columns
                .flatMap((column) => column.links)
                .map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} onClick={onClose} className="font-body text-nav">
                      {link.label}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        ))}
        <Link
          href={SALE_LINK.href}
          onClick={onClose}
          className="font-headline text-display text-accent block uppercase"
        >
          {SALE_LINK.label}
        </Link>
      </nav>
    </div>
  );
}
