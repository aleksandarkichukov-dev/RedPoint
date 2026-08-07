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
    /** `{ "Цвят 25": "тъмно синьо" }`, sampled from the photography by
     *  `apps/backend/src/scripts/name-colors.ts`. */
    color_names?: Record<string, string>;
    /** `{ "Цвят 25": "#3c4250" }`, the sampled value behind the name. */
    color_swatches?: Record<string, string>;
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
  /** One category, or a whole subtree — see `categorySubtreeIds`. */
  categoryId?: string | string[];
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

/**
 * How many products one request asks for while walking the catalogue.
 *
 * Overridable so the check script can force several pages out of a small
 * catalogue — with one page the walk is never exercised and the test proves
 * only that a single request works, which is what it did before.
 */
const PAGE_SIZE = Number(process.env.CATALOGUE_PAGE_SIZE) || 200;

/**
 * Somewhere to stop if `count` and the returned rows ever disagree.
 *
 * Not a catalogue limit — it is far above any plausible one. It exists so a
 * bug upstream costs a slow page rather than a server that fetches for ever.
 */
const CEILING = 10_000;

/**
 * Every product, or every product in a category. Not the first hundred.
 *
 * The four surfaces that need the whole catalogue — search, the chat, the
 * sitemap and a category listing — each asked for `limit: 100` and took what
 * came back. At 88 products that was the whole shop and looked correct. At 101
 * it silently stops being: the search cannot find the newest dress, the chat
 * says an article does not exist while it sits in the shop, and Google is told
 * the catalogue ends at a hundred.
 *
 * Nothing errors in any of those cases, which is what makes it worth a
 * function rather than a bigger number. A bigger number is the same bug with a
 * later start date.
 */
export async function listAllProducts(options: {
  regionId: string;
  categoryId?: string | string[];
  order?: string;
}): Promise<StoreProduct[]> {
  const all: StoreProduct[] = [];
  let offset = 0;

  while (offset < CEILING) {
    const page = await listProducts({ ...options, limit: PAGE_SIZE, offset });
    all.push(...page.products);

    /* Stop on a short page as well as on the count, because those are two
       different ways of being finished and trusting only one of them is how a
       loop either ends early or never ends. */
    if (page.products.length === 0 || all.length >= page.count) break;
    offset += page.products.length;
  }

  return all;
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

/**
 * Several products at once, for the favourites page.
 *
 * Medusa takes `handle` repeated, so this is one request rather than one per
 * favourite. Anything since deleted simply does not come back — a list that
 * quietly loses a discontinued product is right, and the alternative is a card
 * linking to a 404.
 */
export async function listProductsByHandles(
  handles: string[],
  regionId: string,
): Promise<StoreProduct[]> {
  if (handles.length === 0) return [];

  const { products } = await medusaFetch<{ products: StoreProduct[] }>("/store/products", {
    handle: handles,
    region_id: regionId,
    limit: handles.length,
    fields: PRODUCT_FIELDS,
  });

  /* Medusa answers in its own order; the list reads newest-first, which is the
     order the shopper added them in. */
  const byHandle = new Map(products.map((product) => [product.handle, product]));
  return handles
    .map((handle) => byHandle.get(handle))
    .filter((product): product is StoreProduct => product !== undefined);
}

export async function listCategories(): Promise<StoreCategory[]> {
  const { product_categories } = await medusaFetch<{
    product_categories: StoreCategory[];
  }>("/store/product-categories", {
    /* The tree is 27 deep today and is a shape somebody designs, not something
       that accumulates — so one request is honest here in a way it was not for
       products. Well clear of the ceiling, and named so it does not read as
       another quiet hundred. */
    limit: 500,
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

/**
 * A category id together with every category beneath it.
 *
 * The tree has grouping levels — "Мъже", and under it "Якета", "Блузи",
 * "Панталони", "Още" — that hold no products of their own; every garment hangs
 * off a leaf. Asking Medusa for a group on its own therefore returns nothing,
 * which is what a shopper used to get for clicking a heading in the mega menu
 * or the "Мъже" tab itself: a real category, a 200, and an empty page.
 *
 * Breadth-first over a flat list rather than a nested fetch, because
 * `listCategories` already has the whole tree and it is 25 nodes.
 */
export function categorySubtreeIds(rootId: string, all: StoreCategory[]): string[] {
  const ids = [rootId];
  const seen = new Set(ids);
  for (let index = 0; index < ids.length; index += 1) {
    for (const candidate of all) {
      if (candidate.parent_category_id === ids[index] && !seen.has(candidate.id)) {
        seen.add(candidate.id);
        ids.push(candidate.id);
      }
    }
  }
  return ids;
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
  /** What a shopper reads: "тъмно синьо". */
  name: string;
  /** The raw option value, "Цвят 25". Part of every variant SKU, so it stays
   *  the identity even once the name changes. */
  value: string;
  images: string[];
  /** Sampled hex behind the name, when the photography gave one. */
  hex?: string;
  /** Sizes for this colour, with the ones that are out of stock kept and
   *  flagged rather than dropped: a shopper needs to see that L exists and is
   *  gone, not wonder whether the shop stocks it at all. */
  sizes: { label: string; inStock: boolean; variantId: string }[];
}

function optionValue(variant: StoreVariant, title: string): string | null {
  return variant.options.find((o) => o.option?.title === title)?.value ?? null;
}

/**
 * The readable name for a colour option value.
 *
 * The old site records no colour, only an id, so the catalogue arrived full of
 * variants called "Цвят 25". `name-colors.ts` samples each product's own
 * photography and writes the result here. Anything it could not sample falls
 * back to the id, which is unhelpful but at least true.
 */
export function colorDisplayName(product: StoreProduct, value: string): string {
  return product.metadata?.color_names?.[value] ?? value;
}

/**
 * "синьо · 31" for a line in a cart, an order or a confirmation email.
 *
 * Shared because a basket, an order summary and an email each read the variant
 * straight off the API, and each one that forgets the rename shows `Цвят 25`
 * next to a product the shopper chose as "синьо". A change of wording between
 * choosing an item and paying for it reads as a change of item.
 */
export function readableVariant(
  options: { value: string; option?: { title?: string | null } | null }[] | null | undefined,
  colorNames: Record<string, string> | null | undefined,
): string {
  return (options ?? [])
    .map((option) =>
      option.option?.title === OPTION_COLOR
        ? (colorNames?.[option.value] ?? option.value)
        : option.value,
    )
    .filter(Boolean)
    .join(" · ");
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
        name: colorDisplayName(product, color),
        value: color,
        images: product.metadata?.color_images?.[color] ?? [],
        hex: product.metadata?.color_swatches?.[color],
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
 * One representative photograph per category, taken from a product that is
 * actually in it.
 *
 * The tile still links to the whole category. Only the picture comes from a
 * garment, which is the point: a shopper should be able to tell what a category
 * contains by looking at it.
 *
 * A category with no products yields no tile rather than an empty grey box, so
 * the row never advertises somewhere there is nothing to buy.
 */
export async function resolveCategoryTiles(
  categories: { label: string; handle: string }[],
  regionId: string,
): Promise<{ label: string; href: string; image: string; alt: string }[]> {
  const resolved = await Promise.all(
    categories.map(async (category) => {
      const found = await getCategoryByHandle(category.handle);
      if (!found) return null;

      const { products } = await listProducts({
        regionId,
        categoryId: found.id,
        limit: 1,
      });
      const product = products[0];
      if (!product) return null;

      // The first colour's first shot, the same image the product card leads
      // with, so the tile and the listing agree on what the garment looks like.
      const image = toColorOptions(product)[0]?.images[0] ?? product.images[0]?.url;
      if (!image) return null;

      return {
        label: category.label,
        href: `/${found.handle}`,
        image,
        alt: `${category.label}: ${product.title}`,
      };
    }),
  );

  return resolved.filter((tile): tile is NonNullable<typeof tile> => tile !== null);
}

/**
 * StoreProduct to the shape a product card takes.
 *
 * The two card images are the first two of the FIRST colour, not the first two
 * of the product, so the hover swap stays within one colourway instead of
 * flipping between two different garments.
 */
/**
 * The product name without its article number.
 *
 * Every name on the old site ends in the article number — "Тъмносиньо
 * спортно-техническо яке 16876" — which is how the shop's staff find a garment
 * but means nothing to a shopper scanning a grid, and it eats one of the two
 * lines the card allows. The product page still shows it, on its own line and
 * labelled, which is where someone phoning the shop would go looking.
 *
 * Only ever strips the number the catalogue actually recorded for that product,
 * so a name that legitimately ends in digits keeps them.
 */
export function cardTitle(product: StoreProduct): string {
  const article = product.metadata?.article_no;
  if (!article) return product.title;

  const suffix = ` ${article}`;
  return product.title.endsWith(suffix)
    ? product.title.slice(0, -suffix.length).trimEnd()
    : product.title;
}

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
    handle: product.handle,
    name: cardTitle(product),
    images,
    price: displayPrice(product) ?? 0,
    compareAtPrice: compareAtPrice(product),
    colors: colors.map((color) => ({
      id: color.value,
      name: color.name,
      hex: color.hex,
      image: color.images[0],
    })),
  };
}
