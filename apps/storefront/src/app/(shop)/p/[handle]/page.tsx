import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/pdp/product-detail";
import { ProductCard } from "@/components/ui/product-card";
import { ProductJsonLd } from "@/components/seo/json-ld";
import {
  compareAtPrice,
  displayPrice,
  getProductByHandle,
  getRegionId,
  listProducts,
  toCardProps,
  toColorOptions,
} from "@/lib/catalog";

type PageProps = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { handle } = await params;
  const regionId = await getRegionId();
  const product = await getProductByHandle(decodeURIComponent(handle), regionId);
  if (!product) return {};
  return {
    title: product.title,
    description: product.description?.slice(0, 160) ?? undefined,
    openGraph: { images: product.images[0] ? [product.images[0].url] : undefined },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { handle } = await params;
  const regionId = await getRegionId();
  // Handles are Cyrillic, so the router hands them over percent-encoded.
  const product = await getProductByHandle(decodeURIComponent(handle), regionId);
  if (!product) notFound();

  const category = product.categories[0];
  const related = category
    ? (await listProducts({ regionId, categoryId: category.id, limit: 5 })).products
        .filter((candidate) => candidate.id !== product.id)
        .slice(0, 4)
    : [];

  return (
    <div className="mx-auto flex w-full max-w-(--container-page) flex-col gap-12 px-4 py-8 md:px-8 md:py-12">
      <nav aria-label="Пътека" className="font-body text-body text-muted-text">
        <ol className="flex flex-wrap items-center gap-x-2">
          <li>
            <Link href="/men" className="hover:text-primary">
              Мъже
            </Link>
          </li>
          {category && (
            <>
              <li aria-hidden>/</li>
              <li>
                <Link href={`/${category.handle}`} className="hover:text-primary">
                  {category.name}
                </Link>
              </li>
            </>
          )}
        </ol>
      </nav>

      {/* Read by search engines, invisible to everybody else. It is what puts
          the price and "in stock" under the result rather than the first line
          of the description. */}
      <ProductJsonLd
        name={product.title}
        description={product.description}
        images={product.images.map((image) => image.url)}
        sku={product.metadata?.article_no ?? null}
        price={displayPrice(product) ?? 0}
        inStock={toColorOptions(product).some((color) =>
          color.sizes.some((size) => size.inStock),
        )}
        href={`/p/${product.handle}`}
        material={product.material}
      />

      <ProductDetail
        handle={product.handle}
        title={product.title}
        articleNo={product.metadata?.article_no ?? null}
        price={displayPrice(product) ?? 0}
        compareAtPrice={compareAtPrice(product)}
        material={product.material}
        description={product.description}
        colors={toColorOptions(product)}
        sizeChart={product.metadata?.size_chart ?? []}
      />

      {related.length > 0 && (
        <section className="flex flex-col gap-6">
          <h2>Свързани продукти</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} {...toCardProps(item)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
