import type { ExecArgs, RemoteQueryFunction } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { deleteProductsWorkflow } from "@medusajs/medusa/core-flows";
import { parseBulkRows, BULK_COLUMNS, type BulkRow } from "@redpoint/catalog";
import { planImport, variantSku, type ExistingProduct } from "../modules/bulk/plan";
import { importBulkWorkflow } from "../workflows/import-bulk";

/**
 * Exercises the import against the real database, then removes what it made.
 *
 *   pnpm --filter @redpoint/backend exec medusa exec ./src/scripts/check-bulk-import.ts
 *
 * The planning half is pure and checked in memory. The applying half is not —
 * whether Medusa accepts the shape, whether stock lands where the storefront
 * reads it, whether a second run updates instead of duplicating: none of that
 * can be established without writing to a database and looking.
 *
 * Uses article numbers under 999xx so a failure part-way leaves something
 * obviously disposable rather than a plausible-looking product.
 */

type MedusaQuery = Omit<RemoteQueryFunction, symbol>;

const TEST_SKU = "99901";

const blank = Object.fromEntries(BULK_COLUMNS.map((column) => [column, ""])) as BulkRow;
const row = (values: Partial<BulkRow>): BulkRow => ({ ...blank, ...values });

export default async function checkBulkImport({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve<MedusaQuery>(ContainerRegistrationKeys.QUERY);
  const results: [string, boolean, string?][] = [];
  const check = (name: string, ok: boolean, detail?: string) => results.push([name, ok, detail]);

  // --- planning, in memory --------------------------------------------------
  const sheet = parseBulkRows([
    row({ Артикул: TEST_SKU, Име: "Тестови дънки", Категория: "Дънки", Цвят: "синьо", Размер: "31", Количество: "4", Цена: "45" }),
    row({ Артикул: TEST_SKU, Цвят: "синьо", Размер: "32", Количество: "0" }),
    row({ Артикул: TEST_SKU, Цвят: "черно", Размер: "31", Количество: "2" }),
  ]);
  check("test sheet is valid", sheet.issues.length === 0, JSON.stringify(sheet.issues));

  const fresh = planImport(sheet.products, []);
  check("nothing existing means create", fresh.counts.productsCreated === 1 && fresh.counts.productsUpdated === 0);
  check("three variants planned", fresh.counts.variantsCreated === 3, String(fresh.counts.variantsCreated));

  const pretend: ExistingProduct[] = [
    {
      id: "prod_x",
      externalId: TEST_SKU,
      variants: [
        { id: "var_1", sku: variantSku(TEST_SKU, "синьо", "31") },
        { id: "var_2", sku: variantSku(TEST_SKU, "зелено", "31") },
      ],
    },
  ];
  const second = planImport(sheet.products, pretend);
  check("existing article becomes an update", second.counts.productsUpdated === 1 && second.counts.productsCreated === 0);
  check("known variant counts as updated", second.counts.variantsUpdated === 1, String(second.counts.variantsUpdated));
  check("dropped colour is reported, not deleted", second.counts.variantsOrphaned === 1 &&
    second.orphanedVariants[0]?.sku === variantSku(TEST_SKU, "зелено", "31"));

  // --- the pieces the import needs from the store ---------------------------
  const { data: categories } = await query.graph({ entity: "product_category", fields: ["id", "handle"] });
  const { data: profiles } = await query.graph({ entity: "shipping_profile", fields: ["id"] });
  const { data: locations } = await query.graph({ entity: "stock_location", fields: ["id"] });
  /* The store's channel, matching the route. Taking the first sales channel
     instead is what made imported products invisible in the shop, and a check
     that does not import the way the real path does would not have caught it. */
  const { data: stores } = await query.graph({ entity: "store", fields: ["default_sales_channel_id"] });

  const categoryIds = Object.fromEntries(
    categories.map((category: { handle: string; id: string }) => [category.handle, category.id]),
  );
  const context = {
    categoryIds,
    salesChannelId: stores[0]!.default_sales_channel_id as string,
    shippingProfileId: profiles[0]!.id,
    currencyCode: "eur",
    stockLocationId: locations[0]!.id,
  };

  // --- create ---------------------------------------------------------------
  await importBulkWorkflow(container).run({ input: { plan: fresh, ...context } });

  const readBack = async () => {
    const { data } = await query.graph({
      entity: "product",
      filters: { external_id: TEST_SKU },
      /* `+variants.inventory_quantity`: it is computed rather than stored, and
         without the plus it comes back undefined — which reads exactly like
         stock that was never set. The storefront asks for it the same way. */
      fields: [
        "id",
        "title",
        "external_id",
        "variants.id",
        "variants.sku",
        "+variants.inventory_quantity",
        "categories.handle",
      ],
    });
    return data[0];
  };

  let imported = await readBack();
  check("product was created", Boolean(imported), JSON.stringify(imported));
  check("landed in the right category", imported?.categories?.[0]?.handle === "men-jeans",
    imported?.categories?.[0]?.handle);
  check("all three variants exist", imported?.variants?.length === 3, String(imported?.variants?.length));

  /* Read the stored inventory level rather than the computed
     `inventory_quantity`. That field is not returned by query.graph at all —
     it comes back undefined, which reads exactly like stock that never saved
     and cost a wrong diagnosis. The level is what the import writes, so it is
     what the check should look at. */
  const stockOf = async (color: string, size: string): Promise<number | undefined> => {
    const sku = variantSku(TEST_SKU, color, size);
    const { data: variants } = await query.graph({
      entity: "variant",
      fields: ["sku", "inventory_items.inventory_item_id"],
    });
    const variant = variants.find((entry: { sku: string | null }) => entry.sku === sku);
    const itemId = variant?.inventory_items?.[0]?.inventory_item_id;
    if (!itemId) return undefined;

    const { data: levels } = await query.graph({
      entity: "inventory_level",
      filters: { inventory_item_id: itemId },
      fields: ["stocked_quantity", "location_id"],
    });
    const level = levels.find((entry: { location_id: string }) => entry.location_id === context.stockLocationId);
    return level ? Number(level.stocked_quantity) : undefined;
  };
  { const q = await stockOf("синьо", "31"); check("stock landed where the storefront reads it", q === 4, String(q)); }
  { const q = await stockOf("синьо", "32"); check("a sold-out size is stocked zero, not missing", q === 0, String(q)); }

  // --- run it again, as a stock update --------------------------------------
  const existing: ExistingProduct[] = [
    {
      id: imported!.id,
      externalId: TEST_SKU,
      variants: imported!.variants.map((v: { id: string; sku: string }) => ({ id: v.id, sku: v.sku })),
    },
  ];
  const restock = parseBulkRows([
    row({ Артикул: TEST_SKU, Име: "Тестови дънки", Категория: "Дънки", Цвят: "синьо", Размер: "31", Количество: "9", Цена: "45" }),
    row({ Артикул: TEST_SKU, Цвят: "синьо", Размер: "32", Количество: "1" }),
    row({ Артикул: TEST_SKU, Цвят: "черно", Размер: "31", Количество: "2" }),
  ]);
  await importBulkWorkflow(container).run({
    input: { plan: planImport(restock.products, existing), ...context },
  });

  imported = await readBack();
  check("second run updated instead of duplicating", imported?.variants?.length === 3,
    String(imported?.variants?.length));
  { const q = await stockOf("синьо", "31"); check("stock was rewritten", q === 9, String(q)); }

  const { data: allWithSku } = await query.graph({
    entity: "product",
    filters: { external_id: TEST_SKU },
    fields: ["id"],
  });
  check("still exactly one product for the article", allWithSku.length === 1, String(allWithSku.length));

  // --- clean up -------------------------------------------------------------
  if (imported) {
    await deleteProductsWorkflow(container).run({ input: { ids: [imported.id] } });
    const after = await readBack();
    check("test product removed", !after);
  }

  let failed = 0;
  for (const [name, ok, detail] of results) {
    logger.info(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `  <- ${detail}`}`);
    if (!ok) failed += 1;
  }
  if (failed > 0) throw new Error(`${failed} of ${results.length} import checks failed`);
  logger.info(`all ${results.length} import checks passed`);
}
