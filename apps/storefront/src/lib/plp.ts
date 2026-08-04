import { OPTION_COLOR, OPTION_SIZE, type StoreProduct } from "@/lib/catalog";

/**
 * Facets and filtering for a listing page.
 *
 * Done in memory over the category's products rather than in the query. Medusa
 * has no filter on variant option values, and a category here holds tens of
 * products, not thousands. When it does hold thousands this moves behind the
 * search index the chatbot will need in Phase 8, and the page keeps its shape.
 */

export type SortKey = "new" | "price-asc" | "price-desc";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "new", label: "най-нови" },
  { value: "price-asc", label: "цена: ниска към висока" },
  { value: "price-desc", label: "цена: висока към ниска" },
];

function variantOption(
  variant: StoreProduct["variants"][number],
  title: string,
): string | null {
  return variant.options.find((o) => o.option?.title === title)?.value ?? null;
}

/** Sizes a product can actually be bought in right now. */
export function availableSizes(product: StoreProduct): string[] {
  const sizes = new Set<string>();
  for (const variant of product.variants) {
    if ((variant.inventory_quantity ?? 0) <= 0) continue;
    const size = variantOption(variant, OPTION_SIZE);
    if (size) sizes.add(size);
  }
  return [...sizes];
}

export function productColors(product: StoreProduct): string[] {
  const colors = new Set<string>();
  for (const variant of product.variants) {
    const color = variantOption(variant, OPTION_COLOR);
    if (color) colors.add(color);
  }
  return [...colors];
}

export interface PlpQuery {
  sizes: string[];
  colors: string[];
  sort: SortKey;
  page: number;
}

export function parsePlpQuery(searchParams: Record<string, string | string[] | undefined>): PlpQuery {
  const asArray = (value: string | string[] | undefined): string[] =>
    value === undefined ? [] : Array.isArray(value) ? value : [value];

  const rawSort = asArray(searchParams.sort)[0];
  const sort = SORT_OPTIONS.some((option) => option.value === rawSort)
    ? (rawSort as SortKey)
    : "new";

  const rawPage = Number(asArray(searchParams.page)[0] ?? "1");
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  return { sizes: asArray(searchParams.size), colors: asArray(searchParams.color), sort, page };
}

function lowestPrice(product: StoreProduct): number {
  const amounts = product.variants
    .map((variant) => variant.calculated_price?.calculated_amount)
    .filter((amount): amount is number => typeof amount === "number");
  return amounts.length > 0 ? Math.min(...amounts) : Number.POSITIVE_INFINITY;
}

export function applyPlpQuery(products: StoreProduct[], query: PlpQuery): StoreProduct[] {
  let filtered = products;

  // A size filter means "buyable in this size", not "made in this size".
  if (query.sizes.length > 0) {
    filtered = filtered.filter((product) => {
      const sizes = availableSizes(product);
      return query.sizes.some((size) => sizes.includes(size));
    });
  }

  if (query.colors.length > 0) {
    filtered = filtered.filter((product) => {
      const colors = productColors(product);
      return query.colors.some((color) => colors.includes(color));
    });
  }

  if (query.sort === "price-asc") {
    filtered = [...filtered].sort((a, b) => lowestPrice(a) - lowestPrice(b));
  } else if (query.sort === "price-desc") {
    filtered = [...filtered].sort((a, b) => lowestPrice(b) - lowestPrice(a));
  }

  return filtered;
}

/** Facet options counted against the products that survive the OTHER filters,
 *  so a count never promises results that picking it would not produce. */
export function buildFacetOptions(
  products: StoreProduct[],
  extract: (product: StoreProduct) => string[],
): { value: string; label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const product of products) {
    for (const value of extract(product)) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, label: value, count }))
    .sort((a, b) => a.label.localeCompare(b.label, "bg", { numeric: true }));
}
