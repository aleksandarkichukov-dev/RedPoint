import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlpFilters, type FilterFacet } from "@/components/plp/plp-filters";
import { ProductListing } from "@/components/plp/product-listing";
import {
  categorySubtreeIds,
  getCategoryByHandle,
  getRegionId,
  listCategories,
  listProducts,
} from "@/lib/catalog";
import {
  applyPlpQuery,
  availableSizes,
  buildColorFacetOptions,
  buildFacetOptions,
  compareSizes,
  parsePlpQuery,
  SORT_OPTIONS,
} from "@/lib/plp";

const PAGE_SIZE = 24;
/** One request covers a category at this catalogue size; see lib/plp.ts. */
const FETCH_LIMIT = 100;

type PageProps = {
  params: Promise<{ handle: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { handle } = await params;
  const category = await getCategoryByHandle(handle);
  if (!category) return {};
  return {
    title: `${category.name} · Red Point`,
    description: `Мъжки ${category.name.toLowerCase()} от Red Point Варна.`,
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { handle } = await params;
  const resolvedSearchParams = await searchParams;
  const query = parsePlpQuery(resolvedSearchParams);

  const category = await getCategoryByHandle(handle);
  if (!category) notFound();

  const [regionId, allCategories] = await Promise.all([getRegionId(), listCategories()]);

  /* The subtree, not the category alone. Grouping levels carry no products of
     their own, so asking for one by itself renders an empty listing under a
     perfectly valid heading. */
  const { products: fetched } = await listProducts({
    regionId,
    categoryId: categorySubtreeIds(category.id, allCategories),
    limit: FETCH_LIMIT,
  });

  const filtered = applyPlpQuery(fetched, query);
  const offset = (query.page - 1) * PAGE_SIZE;
  const pageProducts = filtered.slice(offset, offset + PAGE_SIZE);

  /* Facets count against the products that survive the OTHER filters, so
     picking a size never shows a count the selection cannot deliver. */
  const sizeFacetSource = applyPlpQuery(fetched, { ...query, sizes: [] });
  const colorFacetSource = applyPlpQuery(fetched, { ...query, colors: [] });

  const facets: FilterFacet[] = [
    {
      param: "size",
      label: "Размер",
      multiple: true,
      // Smallest to largest, across three unrelated sizing systems.
      options: buildFacetOptions(sizeFacetSource, availableSizes, compareSizes),
    },
    {
      param: "color",
      label: "Цвят",
      multiple: true,
      // Alphabetical, each with the averaged chip for that colour.
      options: buildColorFacetOptions(colorFacetSource),
    },
    {
      param: "sort",
      label: "Подреди",
      options: SORT_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
    },
  ].filter((facet) => facet.options.length > 0);

  const children = allCategories.filter(
    (candidate) => candidate.parent_category_id === category.id,
  );

  return (
    <div className="mx-auto flex w-full max-w-(--container-page) flex-col gap-6 px-4 py-8 md:px-8 md:py-12">
      <header className="flex flex-col gap-4">
        <h1 className="text-display">{category.name}</h1>

        {children.length > 0 && (
          <nav aria-label="Подкатегории">
            <ul className="flex flex-wrap gap-x-4 gap-y-2">
              {children.map((child) => (
                <li key={child.id}>
                  <Link
                    href={`/${child.handle}`}
                    className="font-body text-nav text-body-text underline underline-offset-4 hover:text-primary"
                  >
                    {child.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>

      {facets.length > 0 && <PlpFilters facets={facets} />}

      <ProductListing
        products={pageProducts}
        count={filtered.length}
        page={query.page}
        pageSize={PAGE_SIZE}
        basePath={`/${category.handle}`}
        searchParams={resolvedSearchParams}
      />
    </div>
  );
}
