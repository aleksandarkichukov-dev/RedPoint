import { cn } from "@/lib/cn";

/**
 * The Red Point wordmark: the shop's name with the O replaced by a solid red
 * disc, matching the logo the shop uses today.
 *
 * Two deliberate departures from the design system, both because this is the
 * client's actual mark rather than something we are designing:
 *
 *  - It is round. Everything else in this system is square, and `rounded-full`
 *    is banned by review, so the disc is an SVG circle instead of a border
 *    radius. Nothing else on the site may follow it.
 *  - It is red. The accent was reserved for sale signage, but the sale category
 *    has been removed, so the mark is now the only thing carrying it — one
 *    meaning for one colour, which is what the rule was protecting.
 *
 * The letters take `currentColor` rather than a fixed white. The original is
 * white on the old site's dark bar; here the header is white on catalogue
 * pages, where white letters would be invisible. So the mark inverts with its
 * surface and the disc stays red on both.
 *
 * `tagline` sets the strapline the shop carries under its logo. It is off by
 * default: the header bar is 56px tall and a second line would crowd it. The
 * footer has the room.
 *
 * `disc` swaps the red circle back for a plain letter O. It exists for the
 * transparent header over the home page hero: the campaign photography is light
 * at the top, so the white letters wash out while the red disc stays perfectly
 * legible, and what is left reads as a red dot floating on its own. Without the
 * disc the mark is faint, but it is a mark rather than a stray circle.
 */
export function Wordmark({
  className,
  tagline = false,
  disc = true,
}: {
  className?: string;
  tagline?: boolean;
  disc?: boolean;
}) {
  const mark = (
    <span
      className={cn(
        "font-headline leading-none font-bold tracking-[0.06em] uppercase",
        className,
      )}
    >
      Red P
      {/* The disc replaces the O rather than sitting behind it. The letter
          stays in the DOM at zero opacity so the mark still reads "Red Point"
          to a screen reader and to anyone selecting the text, and so it keeps
          reserving its own width. The disc is wider than the glyph, so the
          wrapper carries margin equal to that overflow — without it the circle
          runs into the P and the I. */}
      {/* The margin stays whether or not the disc is showing. Dropping it with
          the disc would re-space the whole mark mid-scroll, and a logo that
          changes width as you scroll past it is worse than one slightly loose
          letter. Both layers cross-fade on the same timing as the bar itself. */}
      <span className="relative mx-[0.2em] inline-block">
        <span
          className={cn(
            "relative transition-opacity duration-(--duration-base)",
            disc ? "opacity-0" : "opacity-100",
          )}
        >
          o
        </span>
        <svg
          aria-hidden
          viewBox="0 0 100 100"
          className={cn(
            "pointer-events-none absolute top-1/2 left-1/2 size-[1.05em] -translate-x-1/2 -translate-y-1/2",
            "transition-opacity duration-(--duration-base)",
            disc ? "opacity-100" : "opacity-0",
          )}
        >
          <circle cx="50" cy="50" r="50" fill="var(--color-accent)" />
        </svg>
      </span>
      int
    </span>
  );

  if (!tagline) return mark;

  return (
    <span className="flex flex-col gap-1">
      {mark}
      <span className="font-body text-body tracking-[0.02em] lowercase opacity-70">
        онлайн магазин за мъжки дрехи
      </span>
    </span>
  );
}
