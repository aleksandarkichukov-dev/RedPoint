import Link from "next/link";
import { ProductCard } from "@/components/ui/product-card";
import { toCardProps, type StoreProduct } from "@/lib/catalog";

export interface ProductGridProps {
  title: string;
  products: StoreProduct[];
  viewAll?: { label: string; href: string };
}

/**
 * Four across on desktop, two on mobile, matching the PLP spec so the home page
 * and the listing pages stay one design rather than two.
 */
export function ProductGrid({ title, products, viewAll }: ProductGridProps) {
  if (products.length === 0) return null;

  return (
    <section className="mx-auto flex w-full max-w-(--container-page) flex-col gap-6 px-4 py-8 md:px-8 md:py-16">
      <div className="flex items-end justify-between gap-4">
        <h2>{title}</h2>
        {viewAll && (
          <Link
            href={viewAll.href}
            className="shrink-0 font-body text-nav text-primary underline underline-offset-4"
          >
            {viewAll.label}
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} {...toCardProps(product)} />
        ))}
      </div>
    </section>
  );
}
