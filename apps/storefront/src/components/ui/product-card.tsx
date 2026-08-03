import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { WishlistButton } from "@/components/ui/wishlist-button";
import { cn } from "@/lib/cn";
import { discountPercent, formatBgn, formatEur } from "@/lib/price";

export interface ProductColor {
  id: string;
  name: string;
  hex: string;
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
    <article className={cn("group flex flex-col gap-3", className)}>
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
              className={cn(
                "object-cover transition-opacity duration-(--duration-base)",
                secondary && "group-hover:opacity-0",
              )}
            />
            {secondary && (
              <Image
                src={secondary.src}
                alt=""
                fill
                sizes="(min-width: 1024px) 25vw, 50vw"
                className="object-cover opacity-0 transition-opacity duration-(--duration-base) group-hover:opacity-100"
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
        <h3 className="font-body text-nav font-normal text-primary uppercase">
          <Link href={href} className="hover:underline">
            {name}
          </Link>
        </h3>

        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-body text-price text-body-text">
            {formatEur(price)}
          </span>
          <span className="font-body text-body text-muted-text">
            ({formatBgn(price)})
          </span>
          {compareAtPrice && discount !== null && (
            <span className="font-body text-price font-semibold text-muted-text line-through">
              {formatEur(compareAtPrice)}
            </span>
          )}
        </p>

        {colors.length > 0 && (
          <ul className="flex items-center gap-2" aria-label="Налични цветове">
            {visibleColors.map((color) => (
              <li key={color.id}>
                <span
                  className="block size-3 border border-border"
                  style={{ backgroundColor: color.hex }}
                  title={color.name}
                />
                <span className="sr-only">{color.name}</span>
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
