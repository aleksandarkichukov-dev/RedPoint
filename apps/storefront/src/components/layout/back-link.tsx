"use client";

import { ArrowLeft } from "@phosphor-icons/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * One step back, on every catalogue page.
 *
 * Browser history rather than a link to the parent category: someone who
 * reached a product from the favourites page, from search or from a related
 * product wants to return where they came from, not to where the product
 * happens to sit in the tree. The breadcrumb above the title already offers
 * the tree.
 *
 * It only renders when there is somewhere to go. On a page opened directly —
 * a shared link, a search result, a new tab — `back()` would either do nothing
 * or throw the visitor off the site on their first click, and a control that
 * silently does nothing is worse than no control.
 */
/**
 * Did we arrive from a different page of this site through a full page load?
 *
 * A reload keeps the referrer, and on a page opened straight from a shared
 * link that referrer is the page itself. Counting it would put the arrow on a
 * visit whose only previous entry is wherever the link was opened from — so a
 * referrer pointing at this same path means a reload, not an arrival.
 */
function cameFromAnotherPageOfOurs(): boolean {
  const referrer = document.referrer;
  if (!referrer.startsWith(window.location.origin)) return false;

  try {
    return new URL(referrer).pathname !== window.location.pathname;
  } catch {
    return false;
  }
}

export function BackLink() {
  const router = useRouter();
  const pathname = usePathname();
  const [canGoBack, setCanGoBack] = useState(false);

  /* Counted per tab rather than read from `history.length`, which cannot tell
     our pages from anything else the tab has been to — a tab opened blank and
     pointed at a product already reports 2, so the arrow would offer to go
     back to a blank page.

     A depth of 0 means this is the first page of the visit. A same-origin
     referrer covers the other safe case: arriving from our own page through a
     full reload, where nothing has been counted yet.

     Runs after mount and on every navigation: the server has neither
     sessionStorage nor a referrer, and rendering the arrow first would make it
     flicker away on the pages that cannot use it. */
  useEffect(() => {
    const KEY = "redpoint.nav-depth";
    try {
      const depth = Number(window.sessionStorage.getItem(KEY) ?? "0");
      setCanGoBack(depth > 0 || cameFromAnotherPageOfOurs());
      window.sessionStorage.setItem(KEY, String(depth + 1));
    } catch {
      /* Storage denied. Without a way to know, offer nothing rather than a
         control that might throw the visitor off the site. */
      setCanGoBack(false);
    }
  }, [pathname]);

  if (!canGoBack) return null;

  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label="Назад към предишната страница"
      /* py-3 rather than py-2: 36px was under the 44 a thumb wants, and this is
         the control somebody uses one-handed on a phone while scrolling back
         through a category. */
      className="group -my-1 -ml-2.5 flex w-fit items-center py-3 pl-2.5 pr-3 font-body text-control text-primary active:scale-[0.97]"
    >
      {/* Grows and thickens on hover, the same answer the filter triggers give.
          Arrow and label scale together from the left edge so they keep their
          spacing, and because `scale` moves nothing in the layout the title
          below stays exactly where it is.

          The arrow is wrapped because Phosphor icons take no className — the
          same reason the header sizes them through the parent's font-size. */}
      <span
        className={cn(
          "flex origin-left items-center gap-2",
          "transition-[scale,font-weight] duration-(--duration-fast)",
          "group-hover:scale-108 group-hover:font-semibold",
        )}
      >
        <span className="grid place-items-center">
          <ArrowLeft size={18} aria-hidden />
        </span>
        назад
      </span>
    </button>
  );
}
