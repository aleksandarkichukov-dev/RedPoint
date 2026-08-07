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
      {/* -my-2 keeps the row where it was while each link grows a thumb's
          worth of padding. They were 16px tall, which on a phone is two words
          a few pixels apart — and this is the crumb somebody taps to go back
          to the category they were browsing. */}
      <nav aria-label="Пътека" className="-my-2 font-body text-body text-muted-text">
        <ol className="flex flex-wrap items-center gap-x-2">
          <li>
            <Link href="/men" className="block py-2 hover:text-primary">
              Мъже
            </Link>
          </li>
          {category && (
            <>
              <li aria-hidden>/</li>
              <li>
                <Link href={`/${category.handle}`} className="block py-2 hover:text-primary">
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
