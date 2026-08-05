import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { WishlistButton } from "@/components/ui/wishlist-button";
import { cn } from "@/lib/cn";
import { discountPercent, formatEur } from "@/lib/price";

/**
 * A colour swatch.
 *
 * The old site publishes no colour value anywhere, only a numeric id and a set
 * of photographs, so a real hex is not available for migrated products and
 * `Цвят 25` is the best name there is until the client renames them. A thumbnail
 * of that colour's own photography says more than a grey square would, so
 * `image` wins when present and `hex` is the fallback for anything the client
 * later defines by colour rather than by picture.
 */
export interface ProductColor {
  id: string;
  name: string;
  hex?: string;
  image?: string;
}

export interface ProductCardProps {
  href: string;
  name: string;
  /** Primary image, plus an optional second one revealed on hover. */
  images: { src: string; alt?: string }[];
  /** Price in EUR. BGN is derived at render time, never stored. */
  price: number;
  compareAtPrice?: number;
  colors?: ProductColor[];
  /** Set on above-the-fold cards so the LCP image is not lazy-loaded. */
  priority?: boolean;
  className?: string;
}

const MAX_VISIBLE_SWATCHES = 4;

export function ProductCard({
  href,
  name,
  images,
  price,
  compareAtPrice,
  colors = [],
  priority = false,
  className,
}: ProductCardProps) {
  const [primary, secondary] = images;
  const discount = discountPercent(price, compareAtPrice);
  const visibleColors = colors.slice(0, MAX_VISIBLE_SWATCHES);
  const hiddenColorCount = colors.length - visibleColors.length;

  return (
    /* `relative` is load-bearing. The card contains absolutely positioned
       descendants, including the `sr-only` colour names, and without a
       positioning context here they resolve against the initial containing
       block. Absolutely positioned elements are not clipped by an unpositioned
       overflow ancestor, so inside a horizontal rail the ones belonging to
       off-screen cards land past the viewport and give the whole page a
       horizontal scrollbar. */
    <article className={cn("group relative flex flex-col gap-3", className)}>
      <div className="relative">
        <Link href={href} className="block" tabIndex={-1} aria-hidden>
          {/* Flat neutral block behind the photography is the only background
              treatment this system has. Ratio matches the source images. */}
          <div className="relative aspect-[502/616] overflow-hidden bg-neutral">
            <Image
              src={primary.src}
              alt={primary.alt ?? ""}
              fill
              sizes="(min-width: 1024px) 25vw, 50vw"
              priority={priority}
              /* 180ms, not 320. A hover is the moment the user is watching for
                 a response, and a third of a second reads as lag.

                 No touch guard needed: Tailwind v4 already compiles every
                 hover and group-hover variant inside @media (hover: hover), so
                 a tap on a phone cannot flash the second image. */
              className={cn(
                "object-cover transition-opacity duration-(--duration-fast)",
                secondary && "group-hover:opacity-0",
              )}
            />
            {secondary && (
              <Image
                src={secondary.src}
                alt=""
                fill
                sizes="(min-width: 1024px) 25vw, 50vw"
                className="object-cover opacity-0 transition-opacity duration-(--duration-fast) group-hover:opacity-100"
              />
            )}
          </div>
        </Link>

        {discount !== null && (
          <Badge variant="sale" className="absolute top-0 left-0">
            {discount}%
          </Badge>
        )}

        <WishlistButton productName={name} className="absolute top-0 right-0" />
      </div>

      <div className="flex flex-col gap-2">
        {/* Two lines, then ellipsis. Bulgarian product names run long enough to
            reach four lines in a two-up grid, which pushes each card's price to
            a different height and makes the row read as ragged rather than as a
            grid. The full name is on the product page. */}
        <h3 className="line-clamp-2 font-body text-nav font-normal text-primary uppercase">
          <Link href={href} className="hover:underline">
            {name}
          </Link>
        </h3>

        {/* EUR only. The BGN conversion is a legal requirement at the point of
            purchase, not something a shopper needs on every tile — carrying it
            here doubled the width of the price line and put a bracketed number
            between the price and the one it is discounted from. The product
            page still shows it.

            The old price is normal weight, not semibold. It was already grey,
            but at 600 it held its own against the current price and read as a
            second price rather than as a struck-out one. */}
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-body text-price text-body-text">
            {formatEur(price)}
          </span>
          {compareAtPrice && discount !== null && (
            <span className="font-body text-price font-normal text-muted-text line-through">
              {formatEur(compareAtPrice)}
            </span>
          )}
        </p>

        {/* Every card carries its colour, not only the ones offered in several.
            Previously this row appeared only above a second colour, so a whole
            page of jeans showed no colour at all and the grid looked ragged.

            Flat chips rather than photo thumbnails: the colours are real values
            sampled from the photography now, and a lone thumbnail under a
            product shot is a miniature of the picture directly above it. The
            thumbnail stays as the fallback for anything with no sampled value.
            With one colour the name is spelled out, because there is room and
            it is what a shopper just filtered by. */}
        {colors.length > 0 && (
          <ul className="flex flex-wrap items-center gap-2" aria-label="Налични цветове">
            {visibleColors.map((color) => (
              <li key={color.id} className="flex items-center gap-2">
                {color.hex ? (
                  <span
                    className="block size-4 border border-border"
                    style={{ backgroundColor: color.hex }}
                  />
                ) : color.image ? (
                  <span className="relative block size-6 overflow-hidden bg-neutral">
                    <Image src={color.image} alt="" fill sizes="24px" className="object-cover" />
                  </span>
                ) : null}

                {colors.length === 1 ? (
                  <span className="font-body text-body text-muted-text">{color.name}</span>
                ) : (
                  <span className="sr-only">{color.name}</span>
                )}
              </li>
            ))}
            {hiddenColorCount > 0 && (
              <li className="font-body text-body text-muted-text">
                +{hiddenColorCount}
              </li>
            )}
          </ul>
        )}
      </div>
    </article>
  );
}
