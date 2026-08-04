import { z } from "zod";

/**
 * Shape of `seed/products.json`.
 *
 * The data model is product -> colour -> (images, sizes with availability),
 * because on the old site photography and stock are both per colour. That maps
 * straight onto Medusa: colour x size becomes a ProductVariant with its own
 * InventoryItem, and the image sets become `metadata.color_images`.
 */

export const SizeSchema = z.object({
  /** `data-size` on `li.productSizeBtn`. Kept so a re-run can be diffed. */
  id: z.string().min(1),
  label: z.string().min(1),
  inStock: z.boolean(),
  /**
   * The old site scopes its size buttons to a physical shop
   * (`data-shop` / `data-shopname`). The brief did not mention this and the
   * Medusa mapping in it assumes one inventory level per colour x size, so
   * this is carried through unresolved for a decision in Phase 2.
   */
  shopId: z.string().nullable(),
  shopName: z.string().nullable(),
  /** Per-size measurements read off the size button's own `title`
   *  ("Ширина: 36 Дължина: 98"), independent of the size table. */
  widthCm: z.number().positive().nullable(),
  lengthCm: z.number().positive().nullable(),
});

export const ColorSchema = z.object({
  /** `data-color-id`, and the directory name under seed/images/{sku}/. */
  id: z.string().min(1),
  name: z.string().min(1),
  /** Repo-relative paths to the downloaded originals. */
  images: z.array(z.string().min(1)).min(1),
  sizes: z.array(SizeSchema).min(1),
});

/** One row of the in-store measured size table. A and B are centimetres. */
export const SizeChartRowSchema = z.object({
  size: z.string().min(1),
  widthCm: z.number().positive().nullable(),
  lengthCm: z.number().positive().nullable(),
});

export const PriceSchema = z.object({
  /** What a shopper pays today, in BGN. Never the struck-through figure. */
  bgn: z.number().positive(),
  /** The struck-through original, when the product is discounted. This is what
   *  makes a `-%` badge possible, and it is null on full-price items. */
  compareAtBgn: z.number().positive().nullable(),
  /** Which strategy found it, so a bad run is auditable rather than mysterious. */
  source: z.string().min(1),
});

export const ProductSchema = z.object({
  sku: z.string().min(1),
  /** `product_id` from the old URL. Becomes `product.external_id`. */
  externalId: z.string().min(1),
  handle: z.string().min(1),
  name: z.string().min(1),
  url: z.string().url(),
  categoryKeys: z.array(z.string().min(1)).min(1),
  price: PriceSchema,
  /** Price advertised in JSON-LD. Known to be unreliable, kept only so the
   *  mismatch report can be produced. Never use it as the price. */
  jsonLdPrice: z.number().nullable(),
  /** Full JSON-LD description. Marketing prose with the fibre composition
   *  appended, e.g. "...небрежна визия.99%памук, 1%еластан". */
  description: z.string().nullable(),
  /** Just the composition, pulled out of the description. Maps to
   *  `product.material` in Medusa; the prose does not belong in that field. */
  material: z.string().nullable(),
  available: z.boolean(),
  colors: z.array(ColorSchema).min(1),
  sizeChart: z.array(SizeChartRowSchema),
  scrapedAt: z.string(),
});

export const ProductsFileSchema = z.object({
  scrapedAt: z.string(),
  source: z.string(),
  count: z.number().int().nonnegative(),
  products: z.array(ProductSchema),
});

export type Size = z.infer<typeof SizeSchema>;
export type Color = z.infer<typeof ColorSchema>;
export type SizeChartRow = z.infer<typeof SizeChartRowSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type ProductsFile = z.infer<typeof ProductsFileSchema>;

/** Acceptance criterion from the brief: every product carries at least one
 *  colour, at least one size and at least one image. The `.min(1)` constraints
 *  above encode exactly that, so validation failure is the signal. */
export function validateProductsFile(data: unknown) {
  return ProductsFileSchema.safeParse(data);
}
