import path from "node:path";
import type { Product } from "@redpoint/catalog";

/**
 * Maps one scraped product onto the Medusa v2 create-product input.
 *
 * Kept as a pure function so it can be type-checked and reasoned about without
 * a database, which matters because this is the step that decides the shape of
 * the whole catalogue.
 */

/** Fixed peg. EUR is the store currency; the scraper only ever saw BGN. */
export const BGN_PER_EUR = 1.95583;

export function bgnToEur(bgn: number): number {
  return Math.round((bgn / BGN_PER_EUR) * 100) / 100;
}

/** What the storefront will render back, so drift is visible at seed time. */
export function eurToBgn(eur: number): number {
  return Math.ceil(eur * BGN_PER_EUR * 100) / 100;
}

export interface MapOptions {
  /** Resolved ProductCategory ids for this product's category keys. */
  categoryIds: string[];
  salesChannelId: string;
  shippingProfileId: string;
  /** Turns a repo-relative image path into a URL the backend serves. */
  imageUrl: (repoRelativePath: string) => string;
}

export interface MappedVariant {
  title: string;
  sku: string;
  manage_inventory: true;
  options: Record<string, string>;
  prices: { amount: number; currency_code: string }[];
  metadata: Record<string, unknown>;
  /** Not part of the create input. Carried out so the caller can seed stock
   *  levels once the variants exist and have inventory items. */
  seedQuantity: number;
}

export interface MappedProduct {
  title: string;
  handle: string;
  description: string | undefined;
  status: "published";
  external_id: string;
  material: string | undefined;
  category_ids: string[];
  shipping_profile_id: string;
  images: { url: string }[];
  options: { title: string; values: string[] }[];
  variants: MappedVariant[];
  sales_channels: { id: string }[];
  metadata: Record<string, unknown>;
}

export interface MappingWarning {
  sku: string;
  message: string;
}

const OPTION_COLOR = "Цвят";
const OPTION_SIZE = "Размер";

export function mapProduct(
  product: Product,
  options: MapOptions,
  warnings: MappingWarning[],
): MappedProduct {
  const eur = bgnToEur(product.price.bgn);
  /* Carried in metadata rather than as a Medusa price. Showing a struck-through
     original properly means a price list, which is a Phase 5 decision tied to
     how the client runs promotions. Until then the storefront reads this and
     renders the `-%` badge from it. */
  const compareAtEur =
    product.price.compareAtBgn !== null ? bgnToEur(product.price.compareAtBgn) : null;
  const roundTripBgn = eurToBgn(eur);
  if (Math.abs(roundTripBgn - product.price.bgn) > 0.001) {
    warnings.push({
      sku: product.sku,
      message:
        `price round-trips as ${roundTripBgn} BGN instead of the scraped ` +
        `${product.price.bgn} BGN (stored as ${eur} EUR). Rounding to the ` +
        `nearest cent cannot preserve both directions of the peg.`,
    });
  }

  const colorValues = product.colors.map((color) => color.name);
  // Sizes are per colour on the old site, so the product-level option is the
  // union. A colour that lacks a size simply has no variant for it.
  const sizeValues = [
    ...new Set(product.colors.flatMap((color) => color.sizes.map((size) => size.label))),
  ];

  const variants: MappedVariant[] = [];
  /* Defensive: variant SKUs must be unique or Medusa rejects the entire batch,
     so one malformed product would take the whole catalogue down with it. The
     scraper already de-duplicates, but this is the layer that actually fails,
     so it refuses to emit a duplicate rather than trusting its input. */
  const seenSkus = new Set<string>();
  for (const color of product.colors) {
    for (const size of color.sizes) {
      /* The brief maps the article number onto `variant.sku`, but a product
         with 3 colours x 7 sizes has 21 variants and SKUs must be unique. So
         the article number lives on `product.external_id` and on variant
         metadata, and the variant SKU is a composite of it. */
      const sku = `${product.sku}-${color.id}-${size.id}`;
      if (seenSkus.has(sku)) {
        warnings.push({
          sku: product.sku,
          message: `duplicate variant ${sku} skipped; the source lists that size twice`,
        });
        continue;
      }
      seenSkus.add(sku);

      variants.push({
        title: `${color.name} / ${size.label}`,
        sku,
        manage_inventory: true,
        options: { [OPTION_COLOR]: color.name, [OPTION_SIZE]: size.label },
        prices: [{ amount: eur, currency_code: "eur" }],
        metadata: {
          article_no: product.sku,
          compare_at_eur: compareAtEur,
          source_color_id: color.id,
          source_size_id: size.id,
          source_shop_id: size.shopId,
          width_cm: size.widthCm,
          length_cm: size.lengthCm,
        },
        /* In stock or not is real: the old site never renders a sold-out size,
           so a size present in the table but missing a button is genuinely
           unavailable. The number 10 is not real; the old site publishes no
           quantity anywhere. Zero, however, means zero. */
        seedQuantity: size.inStock ? 10 : 0,
      });
    }
  }

  /* Medusa v2 has no per-variant gallery, so every photo hangs off the product
     and this map tells the storefront which colour shows which. */
  const colorImages: Record<string, string[]> = {};
  const allImages: string[] = [];
  for (const color of product.colors) {
    const urls = color.images.map(options.imageUrl);
    colorImages[color.name] = urls;
    allImages.push(...urls);
  }

  /* The size table and the per-size button measurements are two sources for
     the same thing. The table wins when present; otherwise the buttons fill
     it in, so the storefront only ever reads one field. */
  const sizeChart =
    product.sizeChart.length > 0
      ? product.sizeChart.map((row) => ({
          size: row.size,
          a_cm: row.widthCm,
          b_cm: row.lengthCm,
        }))
      : [
          ...new Map(
            product.colors
              .flatMap((color) => color.sizes)
              .filter((size) => size.widthCm !== null || size.lengthCm !== null)
              .map((size) => [
                size.label,
                { size: size.label, a_cm: size.widthCm, b_cm: size.lengthCm },
              ]),
          ).values(),
        ];

  if (sizeChart.length === 0) {
    warnings.push({ sku: product.sku, message: "no size chart and no per-size measurements" });
  }

  return {
    title: product.name,
    handle: product.handle,
    description: product.description ?? undefined,
    status: "published",
    external_id: product.sku,
    material: product.material ?? undefined,
    category_ids: options.categoryIds,
    shipping_profile_id: options.shippingProfileId,
    images: [...new Set(allImages)].map((url) => ({ url })),
    options: [
      { title: OPTION_COLOR, values: colorValues },
      { title: OPTION_SIZE, values: sizeValues },
    ],
    variants,
    sales_channels: [{ id: options.salesChannelId }],
    metadata: {
      article_no: product.sku,
      source_url: product.url,
      color_images: colorImages,
      size_chart: sizeChart,
      scraped_at: product.scrapedAt,
      /* Kept so the client's price review has every number in one place. */
      scraped_price_bgn: product.price.bgn,
      scraped_compare_at_bgn: product.price.compareAtBgn,
      compare_at_eur: compareAtEur,
      scraped_price_source: product.price.source,
    },
  };
}

/** `seed/images/17487/Цвят-25/1.jpg` -> `products/17487/Цвят-25/1.jpg` */
export function toStaticPath(repoRelativePath: string): string {
  const normalised = repoRelativePath.split(path.sep).join("/");
  return normalised.replace(/^seed\/images\//, "products/");
}
