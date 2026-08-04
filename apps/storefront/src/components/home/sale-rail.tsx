import Link from "next/link";
import { ProductCard } from "@/components/ui/product-card";
import type { DemoProduct } from "@/lib/home";

export interface SaleRailProps {
  title: string;
  products: DemoProduct[];
  viewAll: { label: string; href: string };
}

/**
 * Discounted products as a horizontal rail rather than a second grid.
 *
 * The layout is doing work: a rail says "there is more of this" without
 * committing the page to another four rows, and it keeps the sale section from
 * reading as a repeat of new arrivals directly above it.
 *
 * The `-%` badges come from ProductCard, which only renders one when there is a
 * genuine reduction. That is the only red on the page.
 */
export function SaleRail({ title, products, viewAll }: SaleRailProps) {
  return (
    <section className="flex flex-col gap-6 py-8 md:py-16">
      <div className="mx-auto flex w-full max-w-(--container-page) items-end justify-between gap-4 px-4 md:px-8">
        <h2>{title}</h2>
        <Link
          href={viewAll.href}
          className="shrink-0 font-body text-nav text-primary underline underline-offset-4"
        >
          {viewAll.label}
        </Link>
      </div>

      <ul className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 scroll-pl-4 md:px-8 md:scroll-pl-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {products.map((product) => (
          <li
            key={product.name}
            className="w-[58vw] shrink-0 snap-start sm:w-[34vw] lg:w-[21vw] xl:w-[17rem]"
          >
            <ProductCard {...product} />
          </li>
        ))}
      </ul>
    </section>
  );
}
