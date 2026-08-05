import type { RemoteQueryFunction } from "@medusajs/framework/types";
import {
  matchPhotos,
  parseBulkRows,
  parsePhotoName,
  type BulkIssue,
  type BulkProduct,
} from "@redpoint/catalog";
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

export interface PhotoOnlyReview {
  /** Articles that exist and will have their photography replaced. */
  articles: { sku: string; title: string; productId: string; colors: string[]; photoCount: number }[];
  issues: { row: number; message: string }[];
  total: number;
}

/**
 * A photo upload with no spreadsheet.
 *
 * The common case by far: the article already exists and only its photography
 * is new. Requiring a spreadsheet to change a picture means retyping the price
 * and the category to say nothing about either.
 *
 * Only ever touches articles that already exist. A photograph cannot say what
 * something costs or which category it belongs to, so a new product still
 * needs a sheet — that is arithmetic, not a limitation worth engineering
 * around, and pretending otherwise would create half-made products.
 */
export async function reviewPhotosOnly(
  query: MedusaQuery,
  archive: Buffer,
): Promise<PhotoOnlyReview> {
  const photos = await readPhotoArchive(archive);
  const issues: PhotoOnlyReview["issues"] = [];

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "title", "external_id", "variants.options.value", "variants.options.option.title"],
  });

  const known = new Map<string, { id: string; title: string; colors: Set<string> }>();
  for (const product of products) {
    if (!product.external_id) continue;
    const colors = new Set<string>();
    for (const variant of product.variants ?? []) {
      for (const option of variant.options ?? []) {
        if (option.option?.title === "Цвят" && option.value) colors.add(option.value);
      }
    }
    known.set(product.external_id, { id: product.id, title: product.title, colors });
  }

  const grouped = new Map<string, { colors: Set<string>; count: number }>();

  for (const photo of photos) {
    const parsed = parsePhotoName(photo.fileName);
    if (!parsed) {
      issues.push({
        row: 0,
        message: `"${photo.fileName}" не следва формата {артикул}_{цвят}_{номер}.jpg и се пропуска`,
      });
      continue;
    }

    const product = known.get(parsed.sku);
    if (!product) {
      issues.push({
        row: 0,
        message:
          `Артикул ${parsed.sku} го няма в магазина. ` +
          "Нов артикул се качва с таблица, защото снимка не носи цена и категория.",
      });
      continue;
    }

    if (!product.colors.has(parsed.color)) {
      issues.push({
        row: 0,
        message:
          `Артикул ${parsed.sku} няма цвят "${parsed.color}". ` +
          `Има: ${[...product.colors].join(", ")}`,
      });
      continue;
    }

    const entry = grouped.get(parsed.sku) ?? { colors: new Set<string>(), count: 0 };
    entry.colors.add(parsed.color);
    entry.count += 1;
    grouped.set(parsed.sku, entry);
  }

  return {
    articles: [...grouped.entries()].map(([sku, entry]) => ({
      sku,
      title: known.get(sku)!.title,
      productId: known.get(sku)!.id,
      colors: [...entry.colors],
      photoCount: entry.count,
    })),
    issues,
    total: photos.length,
  };
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
