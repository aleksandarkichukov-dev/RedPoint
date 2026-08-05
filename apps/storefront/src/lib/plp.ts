import {
  colorDisplayName,
  OPTION_COLOR,
  OPTION_SIZE,
  type StoreProduct,
} from "@/lib/catalog";

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

/**
 * Colours as a shopper would name them, not as the old site numbered them.
 *
 * Deliberately the display name rather than the option value: filtering by
 * "Цвят 25" asks a shopper to know a number that means different colours on
 * different garments, and it splits one real colour across several facets.
 * Naming first makes every navy in the catalogue one filter.
 */
export function productColors(product: StoreProduct): string[] {
  const colors = new Set<string>();
  for (const variant of product.variants) {
    const color = variantOption(variant, OPTION_COLOR);
    if (color) colors.add(colorDisplayName(product, color));
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

/* The catalogue carries three unrelated size systems — letters (XS to 6XL),
   numbers for waists and shoes (28 to 45), numbers for belts (110 to 135) —
   plus "Стандартен" for one-size goods. Sorting them as text puts 2XL before S
   and 110 before 28, so each system is ranked on its own terms. */
const LETTER_SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL", "6XL"];

const LETTER_ALIASES: Record<string, string> = {
  XXL: "2XL",
  XXXL: "3XL",
  XXXXL: "4XL",
};

function sizeRank(size: string): [number, number] {
  const normalised = size.trim().toUpperCase();
  const letterIndex = LETTER_SIZES.indexOf(LETTER_ALIASES[normalised] ?? normalised);
  if (letterIndex !== -1) return [0, letterIndex];

  const numeric = Number(normalised);
  if (Number.isFinite(numeric)) return [1, numeric];

  // "Стандартен" and anything else unrecognised sorts last, alphabetically.
  return [2, 0];
}

export function compareSizes(a: string, b: string): number {
  const [groupA, rankA] = sizeRank(a);
  const [groupB, rankB] = sizeRank(b);
  if (groupA !== groupB) return groupA - groupB;
  if (rankA !== rankB) return rankA - rankB;
  return a.localeCompare(b, "bg");
}

export interface FacetOption {
  value: string;
  label: string;
  count: number;
  /** Hex for the colour facet's chip. Absent on every other facet. */
  swatch?: string;
}

/** Facet options counted against the products that survive the OTHER filters,
 *  so a count never promises results that picking it would not produce. */
export function buildFacetOptions(
  products: StoreProduct[],
  extract: (product: StoreProduct) => string[],
  compare: (a: string, b: string) => number = (a, b) =>
    a.localeCompare(b, "bg", { numeric: true }),
): FacetOption[] {
  const counts = new Map<string, number>();
  for (const product of products) {
    for (const value of extract(product)) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, label: value, count }))
    .sort((a, b) => compare(a.value, b.value));
}

/**
 * The colour facet, with a chip for each entry.
 *
 * One name covers several sampled values — every navy in the catalogue is
 * "синьо" — so the chip is the average of them rather than whichever product
 * happened to come first, which would show a shopper one specific garment's
 * navy as if it stood for all of them.
 */
export function buildColorFacetOptions(products: StoreProduct[]): FacetOption[] {
  /* Counted per product, not per variant: a product offered in one colour adds
     one to that colour, however many sizes it comes in. */
  const counts = new Map<string, number>();
  const channels = new Map<string, { r: number; g: number; b: number; n: number }>();

  for (const product of products) {
    const swatches = product.metadata?.color_swatches ?? {};

    for (const name of new Set(productColors(product))) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }

    for (const [raw, hex] of Object.entries(swatches)) {
      const parsed = hex.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
      if (!parsed) continue;
      const name = colorDisplayName(product, raw);
      let entry = channels.get(name);
      if (!entry) channels.set(name, (entry = { r: 0, g: 0, b: 0, n: 0 }));
      entry.r += parseInt(parsed[1]!, 16);
      entry.g += parseInt(parsed[2]!, 16);
      entry.b += parseInt(parsed[3]!, 16);
      entry.n += 1;
    }
  }

  return [...counts.entries()]
    .map(([name, count]) => {
      const entry = channels.get(name);
      const swatch = entry
        ? `#${[entry.r, entry.g, entry.b]
            .map((total) => Math.round(total / entry.n).toString(16).padStart(2, "0"))
            .join("")}`
        : undefined;
      return { value: name, label: name, count, swatch };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "bg"));
}
