import type { RemoteQueryFunction } from "@medusajs/framework/types";
import { matchPhotos, parseBulkRows, type BulkIssue, type BulkProduct } from "@redpoint/catalog";
import { readWorkbook } from "./workbook";
import { readPhotoArchive, photoNames } from "./photos";
import { planImport, type ExistingProduct, type ImportPlan } from "./plan";

/**
 * One pass over an upload: read it, check it, work out what it would do.
 *
 * Shared by the preview and the import so the two can never disagree. The
 * screen shows exactly what the button will carry out, because both come from
 * this function.
 */

type MedusaQuery = Omit<RemoteQueryFunction, symbol>;

export interface BulkReview {
  products: BulkProduct[];
  issues: BulkIssue[];
  plan: ImportPlan | null;
  photos: { byColor: Map<string, string[]>; total: number } | null;
}

export async function reviewUpload(
  query: MedusaQuery,
  files: { sheet: Buffer; photos?: Buffer },
): Promise<BulkReview> {
  const rows = await readWorkbook(files.sheet);
  const { products, issues } = parseBulkRows(rows);

  let photos: BulkReview["photos"] = null;
  const allIssues = [...issues];

  if (files.photos) {
    const archive = await readPhotoArchive(files.photos);
    const matched = matchPhotos(products, photoNames(archive));
    allIssues.push(...matched.issues);
    photos = { byColor: matched.byColor, total: archive.length };
  }

  /* No plan when anything is wrong. The screen must not offer to import a
     sheet it has just told the shop is broken, and computing a plan from
     half-valid rows invites showing counts that will never happen. */
  if (allIssues.some((issue) => issue.row > 0)) {
    return { products, issues: allIssues, plan: null, photos };
  }

  const existing = await loadExisting(query);
  return { products, issues: allIssues, plan: planImport(products, existing), photos };
}

/** What the catalogue already holds, keyed the way the sheet refers to it. */
export async function loadExisting(query: MedusaQuery): Promise<ExistingProduct[]> {
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "external_id", "variants.id", "variants.sku"],
  });

  return data
    .filter((product: { external_id: string | null }) => Boolean(product.external_id))
    .map((product: { id: string; external_id: string; variants?: { id: string; sku: string }[] }) => ({
      id: product.id,
      externalId: product.external_id,
      variants: (product.variants ?? []).map((variant) => ({ id: variant.id, sku: variant.sku })),
    }));
}

/** The catalogue as the sheet would express it, for the export. */
export async function exportCatalogue(query: MedusaQuery): Promise<BulkProduct[]> {
  const { data } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "external_id",
      "description",
      "material",
      "metadata",
      "categories.handle",
      "categories.name",
      "variants.id",
      "variants.sku",
      "variants.options.value",
      "variants.options.option.title",
      "variants.calculated_price.calculated_amount",
    ],
  });

  const products: BulkProduct[] = [];

  for (const product of data) {
    if (!product.external_id) continue;

    const colors = new Map<string, BulkProduct["colors"][number]>();

    for (const variant of product.variants ?? []) {
      const options = variant.options ?? [];
      const color = options.find((o: { option?: { title?: string } }) => o.option?.title === "Цвят")?.value;
      const size = options.find((o: { option?: { title?: string } }) => o.option?.title === "Размер")?.value;
      if (!color || !size) continue;

      const entry: BulkProduct["colors"][number] =
        colors.get(color) ?? { name: color, sizes: [] };
      /* Quantity is filled in by the caller, which has the inventory levels.
         Reading them per variant here would be a query per row. */
      entry.sizes.push({ label: size, quantity: 0 });
      colors.set(color, entry);
    }

    products.push({
      sku: product.external_id,
      name: product.title,
      categoryKey: product.categories?.[0]?.handle ?? "",
      categoryName: product.categories?.[0]?.name ?? "",
      price: Number(product.variants?.[0]?.calculated_price?.calculated_amount ?? 0),
      compareAtPrice: (product.metadata?.compare_at_eur as number | null) ?? null,
      material: product.material ?? null,
      description: product.description ?? null,
      colors: [...colors.values()],
    });
  }

  return products;
}
