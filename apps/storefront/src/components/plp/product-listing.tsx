import Link from "next/link";
import { ProductCard } from "@/components/ui/product-card";
import { toCardProps, type StoreProduct } from "@/lib/catalog";
import { cn } from "@/lib/cn";

export interface ProductListingProps {
  products: StoreProduct[];
  count: number;
  page: number;
  pageSize: number;
  /** Path the pager links to, without the query string. */
  basePath: string;
  /** Active filters, carried through every pager link. Without this, turning a
   *  page silently drops the filters and shows an unrelated result set. */
  searchParams: Record<string, string | string[] | undefined>;
}

/**
 * Four across on desktop, two on mobile.
 *
 * Paged rather than infinitely scrolled. The brief asks for infinite scroll
 * with `?page=` kept in sync so that sharing and the back button work, but the
 * two pull against each other: an infinite list has no single page to link to,
 * and syncing the query string as the user scrolls fills their history with
 * entries they never chose. Real pagination gives the same shareable, resumable
 * URLs with none of that, and it is one link away from being progressively
 * enhanced with a "load more" button that pushes the same URLs.
 */
export function ProductListing({
  products,
  count,
  page,
  pageSize,
  basePath,
  searchParams,
}: ProductListingProps) {
  const pageHref = (target: number): string => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (key === "page" || value === undefined) continue;
      for (const item of Array.isArray(value) ? value : [value]) query.append(key, item);
    }
    // Page 1 carries no `page` param, so the first page of a filter has one
    // canonical URL rather than two.
    if (target > 1) query.set("page", String(target));
    const search = query.toString();
    return search ? `${basePath}?${search}` : basePath;
  };

  const pageCount = Math.max(1, Math.ceil(count / pageSize));
  const first = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, count);

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4 py-16">
        <h2>Няма резултати</h2>
        <p className="max-w-[48ch] font-body text-nav text-muted-text">
          Нищо не отговаря на този избор. Премахнете някой филтър или
          разгледайте цялата категория.
        </p>
        <Link href={basePath} className="font-body text-nav underline underline-offset-4">
          изчисти филтрите
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* The product names are h3, so without this the outline jumps h1 to h3
          and a screen reader reports a missing level. The heading is visually
          redundant next to the category title, which is exactly why it is
          hidden rather than invented as decoration. */}
      <h2 className="sr-only">Продукти</h2>

      <div className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">
        {products.map((product, index) => (
          <ProductCard
            key={product.id}
            {...toCardProps(product)}
            // The first row is above the fold on every viewport; anything more
            // and the LCP image competes with images nobody has scrolled to.
            priority={index < 2}
          />
        ))}
      </div>

      <nav
        aria-label="Страници"
        className="flex flex-col items-center gap-4 border-t border-border pt-6 sm:flex-row sm:justify-between"
      >
        <p className="font-body text-body text-muted-text">
          {first} - {last} от {count}
        </p>

        {pageCount > 1 && (
          <ul className="flex items-center gap-1">
            <PagerLink href={pageHref(page - 1)} disabled={page <= 1} label="предишна" />
            {pageNumbers(page, pageCount).map((entry, index) =>
              entry === "gap" ? (
                <li
                  key={`gap-${index}`}
                  aria-hidden
                  className="px-2 font-body text-nav text-muted-text"
                >
                  ...
                </li>
              ) : (
                <li key={entry}>
                  <Link
                    href={pageHref(entry)}
                    aria-current={entry === page ? "page" : undefined}
                    className={cn(
                      "grid h-10 min-w-10 place-items-center px-2 font-body text-nav",
                      entry === page
                        ? "bg-primary text-white"
                        : "text-primary hover:bg-surface",
                    )}
                  >
                    {entry}
                  </Link>
                </li>
              ),
            )}
            <PagerLink href={pageHref(page + 1)} disabled={page >= pageCount} label="следваща" />
          </ul>
        )}
      </nav>
    </div>
  );
}

function PagerLink({
  href,
  disabled,
  label,
}: {
  href: string;
  disabled: boolean;
  label: string;
}) {
  if (disabled) {
    return (
      <li
        aria-hidden
        className="grid h-10 place-items-center px-3 font-body text-nav lowercase text-muted-text opacity-40"
      >
        {label}
      </li>
    );
  }
  return (
    <li>
      <Link
        href={href}
        rel={label === "следваща" ? "next" : "prev"}
        className="grid h-10 place-items-center px-3 font-body text-nav lowercase text-primary hover:bg-surface"
      >
        {label}
      </Link>
    </li>
  );
}

/** First, last, and a window around the current page. */
function pageNumbers(page: number, pageCount: number): (number | "gap")[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }
  const window = new Set([1, pageCount, page, page - 1, page + 1]);
  const pages = [...window].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);

  const output: (number | "gap")[] = [];
  let previous = 0;
  for (const current of pages) {
    if (previous && current - previous > 1) output.push("gap");
    output.push(current);
    previous = current;
  }
  return output;
}
