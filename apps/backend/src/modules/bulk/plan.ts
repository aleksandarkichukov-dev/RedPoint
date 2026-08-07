import type { BulkProduct } from "@redpoint/catalog";

/**
 * Turns validated rows into exactly what the import will do, before it does any
 * of it.
 *
 * A pure function on purpose. The plan can be counted, shown to the shop and
 * tested without a database, and the workflow that carries it out has no
 * decisions left to make — which is what keeps "all or nothing" honest.
 */

export const OPTION_COLOR = "Цвят";
export const OPTION_SIZE = "Размер";

export interface ExistingProduct {
  id: string;
  /** The article number, carried on the product as `external_id`. */
  externalId: string;
  /** Colour and size are what identify a variant; the sku is only its label. */
  variants: { id: string; sku: string; color?: string; size?: string; inventoryItemId?: string }[];
}

/**
 * What actually identifies a variant: its colour and its size.
 *
 * Not the sku. This module builds skus as `{article}-{colour}-{size}`, and the
 * catalogue scraped from the old site carries skus like `16891-27-chart:M` —
 * so matching on them meant every existing variant looked new. Uploading the
 * shop's own exported catalogue back would have added a second copy of all 801
 * variants and orphaned the originals, which is the exact thing this tool
 * exists to make safe.
 *
 * Colour and size are what a shopkeeper means by "the same item", and they are
 * what the sheet carries in its own columns.
 */
function variantKey(color: string, size: string): string {
  return `${color.trim().toLowerCase()}|${size.trim().toLowerCase()}`;
}

export interface PlannedVariant {
  /** `{article}-{colour}-{size}`, unique across the catalogue. */
  sku: string;
  title: string;
  color: string;
  size: string;
  quantity: number;
  price: number;
  /** Set when this variant already exists and only its stock or price moves. */
  existingVariantId?: string;
}

export interface PlannedProduct {
  sku: string;
  name: string;
  categoryKey: string;
  price: number;
  compareAtPrice: number | null;
  material: string | null;
  description: string | null;
  colors: string[];
  sizes: string[];
  variants: PlannedVariant[];
  existingProductId?: string;
}

export interface ImportPlan {
  create: PlannedProduct[];
  update: PlannedProduct[];
  /** Variants of an existing product that the sheet no longer lists. */
  orphanedVariants: { sku: string; productSku: string }[];
  counts: {
    productsCreated: number;
    productsUpdated: number;
    variantsCreated: number;
    variantsUpdated: number;
    variantsOrphaned: number;
  };
}

/** Variant SKUs must be unique across the whole catalogue or Medusa rejects the
 *  batch, so the article number alone will not do for a product with colours. */
export function variantSku(article: string, color: string, size: string): string {
  return `${article}-${color}-${size}`.replace(/\s+/g, "-");
}

export function planImport(
  products: BulkProduct[],
  existing: ExistingProduct[],
): ImportPlan {
  const existingByArticle = new Map(existing.map((product) => [product.externalId, product]));

  const create: PlannedProduct[] = [];
  const update: PlannedProduct[] = [];
  const orphanedVariants: { sku: string; productSku: string }[] = [];

  let variantsCreated = 0;
  let variantsUpdated = 0;

  for (const product of products) {
    const current = existingByArticle.get(product.sku);
    /* Keyed by colour and size. A variant with neither recorded cannot be
       matched at all and is left out, so it shows up as orphaned rather than
       being silently paired with the wrong row. */
    const currentVariants = new Map(
      (current?.variants ?? [])
        .filter((variant) => variant.color && variant.size)
        .map((variant) => [variantKey(variant.color!, variant.size!), variant]),
    );

    const variants: PlannedVariant[] = [];
    const colors: string[] = [];
    const sizes: string[] = [];

    for (const color of product.colors) {
      if (!colors.includes(color.name)) colors.push(color.name);
      for (const size of color.sizes) {
        if (!sizes.includes(size.label)) sizes.push(size.label);

        const existingVariant = currentVariants.get(variantKey(color.name, size.label));
        if (existingVariant) variantsUpdated += 1;
        else variantsCreated += 1;

        /* An existing variant keeps the sku it already has. Ours is only ever
           invented for a new one — renaming a variant's sku on every upload
           would rewrite identifiers the shop may have printed on something. */
        const sku = existingVariant?.sku ?? variantSku(product.sku, color.name, size.label);

        variants.push({
          sku,
          title: `${color.name} / ${size.label}`,
          color: color.name,
          size: size.label,
          quantity: size.quantity,
          price: product.price,
          existingVariantId: existingVariant?.id,
        });
      }
    }

    const planned: PlannedProduct = {
      sku: product.sku,
      name: product.name,
      categoryKey: product.categoryKey,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      material: product.material,
      description: product.description,
      colors,
      sizes,
      variants,
      existingProductId: current?.id,
    };

    if (current) {
      update.push(planned);

      /* A colour or size dropped from the sheet. Reported rather than deleted:
         a variant that has been ordered cannot simply vanish, and a shop that
         forgot a row should be told, not silently obeyed. */
      const plannedKeys = new Set(
        variants.map((variant) => variantKey(variant.color, variant.size)),
      );
      for (const variant of current.variants) {
        const key =
          variant.color && variant.size ? variantKey(variant.color, variant.size) : null;
        if (!key || !plannedKeys.has(key)) {
          orphanedVariants.push({ sku: variant.sku, productSku: product.sku });
        }
      }
    } else {
      create.push(planned);
    }
  }

  return {
    create,
    update,
    orphanedVariants,
    counts: {
      productsCreated: create.length,
      productsUpdated: update.length,
      variantsCreated,
      variantsUpdated,
      variantsOrphaned: orphanedVariants.length,
    },
  };
}
