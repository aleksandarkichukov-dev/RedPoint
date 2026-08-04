import { medusaFetch } from "@/lib/medusa";

/**
 * Narrow views of the Store API, describing only what the storefront renders.
 *
 * Hand-written rather than pulled from Medusa's types on purpose: these mirror
 * the `fields` each query asks for, so if a query stops requesting something,
 * the type stops offering it and the compiler says where.
 */

export interface StoreCategory {
  id: string;
  name: string;
  handle: string;
  parent_category_id: string | null;
}

export interface StoreVariantPrice {
  calculated_amount: number;
  currency_code: string;
}

export interface StoreVariant {
  id: string;
  title: string;
  sku: string | null;
  /** `{ "Цвят": "Цвят 25", "Размер": "L" }` */
  options: { option: { title: string } | null; value: string }[];
  calculated_price: StoreVariantPrice | null;
  inventory_quantity: number | null;
  metadata: {
    article_no?: string;
    compare_at_eur?: number | null;
    source_color_id?: string;
    width_cm?: number | null;
    length_cm?: number | null;
  } | null;
}

export interface StoreProduct {
  id: string;
  title: string;
  handle: string;
  description: string | null;
  material: string | null;
  images: { id: string; url: string }[];
  categories: { id: string; name: string; handle: string }[];
  options: { id: string; title: string; values: { id: string; value: string }[] }[];
  variants: StoreVariant[];
  metadata: {
    article_no?: string;
    /** `{ "Цвят 25": ["url", ...] }` */
    color_images?: Record<string, string[]>;
    size_chart?: { size: string; a_cm: number | null; b_cm: number | null }[];
    compare_at_eur?: number | null;
    scraped_price_bgn?: number;
  } | null;
}

export const OPTION_COLOR = "Цвят";
export const OPTION_SIZE = "Размер";

/** Everything a product card or product page needs, in one round trip. */
const PRODUCT_FIELDS = [
  "id",
  "title",
  "handle",
  "description",
  "material",
  "metadata",
  "*images",
  "*categories",
  "*options",
  "*options.values",
  "*variants",
  "*variants.options",
  "*variants.calculated_price",
  "+variants.inventory_quantity",
].join(",");

export interface ProductPage {
  products: StoreProduct[];
  count: number;
  offset: number;
  limit: number;
}

export async function listProducts(options: {
  regionId: string;
  categoryId?: string;
  limit?: number;
  offset?: number;
  order?: string;
}): Promise<ProductPage> {
  return medusaFetch<ProductPage>("/store/products", {
    region_id: options.regionId,
    category_id: options.categoryId,
    limit: options.limit ?? 24,
    offset: options.offset ?? 0,
    order: options.order,
    fields: PRODUCT_FIELDS,
  });
}

export async function getProductByHandle(
  handle: string,
  regionId: string,
): Promise<StoreProduct | null> {
  const { products } = await medusaFetch<{ products: StoreProduct[] }>(
    "/store/products",
    { handle, region_id: regionId, limit: 1, fields: PRODUCT_FIELDS },
  );
  return products[0] ?? null;
}

export async function listCategories(): Promise<StoreCategory[]> {
  const { product_categories } = await medusaFetch<{
    product_categories: StoreCategory[];
  }>("/store/product-categories", {
    limit: 100,
    fields: "id,name,handle,parent_category_id",
  });
  return product_categories;
}

export async function getCategoryByHandle(handle: string): Promise<StoreCategory | null> {
  const { product_categories } = await medusaFetch<{
    product_categories: StoreCategory[];
  }>("/store/product-categories", {
    handle,
    limit: 1,
    fields: "id,name,handle,parent_category_id",
  });
  return product_categories[0] ?? null;
}

/** The store has one region. Cached like everything else, so this is not a
 *  request per page render. */
export async function getRegionId(): Promise<string> {
  const { regions } = await medusaFetch<{ regions: { id: string }[] }>(
    "/store/regions",
    { limit: 1 },
  );
  const region = regions[0];
  if (!region) throw new Error("no region configured in Medusa");
  return region.id;
}

// --- derived views ----------------------------------------------------------

export interface ColorOption {
  name: string;
  images: string[];
  /** Sizes for this colour, with the ones that are out of stock kept and
   *  flagged rather than dropped: a shopper needs to see that L exists and is
   *  gone, not wonder whether the shop stocks it at all. */
  sizes: { label: string; inStock: boolean; variantId: string }[];
}

function optionValue(variant: StoreVariant, title: string): string | null {
  return variant.options.find((o) => o.option?.title === title)?.value ?? null;
}

/** Groups a product's variants into the colour-then-size shape the PDP shows. */
export function toColorOptions(product: StoreProduct): ColorOption[] {
  const byColor = new Map<string, ColorOption>();

  for (const variant of product.variants) {
    const color = optionValue(variant, OPTION_COLOR);
    const size = optionValue(variant, OPTION_SIZE);
    if (!color || !size) continue;

    let entry = byColor.get(color);
    if (!entry) {
      entry = {
        name: color,
        images: product.metadata?.color_images?.[color] ?? [],
        sizes: [],
      };
      byColor.set(color, entry);
    }
    entry.sizes.push({
      label: size,
      inStock: (variant.inventory_quantity ?? 0) > 0,
      variantId: variant.id,
    });
  }

  return [...byColor.values()];
}

/** Cheapest current price across a product's variants, which is what a listing
 *  card shows. They are all the same today, but a price list in Phase 5 will
 *  change that. */
export function displayPrice(product: StoreProduct): number | null {
  const amounts = product.variants
    .map((variant) => variant.calculated_price?.calculated_amount)
    .filter((amount): amount is number => typeof amount === "number");
  return amounts.length > 0 ? Math.min(...amounts) : null;
}

export function compareAtPrice(product: StoreProduct): number | undefined {
  const value = product.metadata?.compare_at_eur;
  return typeof value === "number" && value > 0 ? value : undefined;
}

export function productHref(product: StoreProduct): string {
  return `/p/${product.handle}`;
}

/**
 * StoreProduct to the shape a product card takes.
 *
 * The two card images are the first two of the FIRST colour, not the first two
 * of the product, so the hover swap stays within one colourway instead of
 * flipping between two different garments.
 */
export function toCardProps(product: StoreProduct) {
  const colors = toColorOptions(product);
  const firstColorImages = colors[0]?.images ?? [];
  const images = (firstColorImages.length > 0
    ? firstColorImages
    : product.images.map((image) => image.url)
  )
    .slice(0, 2)
    .map((url, index) => ({
      src: url,
      alt: index === 0 ? product.title : undefined,
    }));

  return {
    href: productHref(product),
    name: product.title,
    images,
    price: displayPrice(product) ?? 0,
    compareAtPrice: compareAtPrice(product),
    colors: colors.map((color) => ({
      id: color.name,
      name: color.name,
      image: color.images[0],
    })),
  };
}
