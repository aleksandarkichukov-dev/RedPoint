import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { ExecArgs } from "@medusajs/framework/types";
import { parseBulkRows } from "@redpoint/catalog";
import { exportCatalogue, loadExisting } from "../modules/bulk/service";
import { planImport } from "../modules/bulk/plan";
import { stockByVariant } from "../modules/bulk/stock";
import { readWorkbook, writeWorkbook } from "../modules/bulk/workbook";

/**
 * The export's one promise: download, upload back untouched, nothing changes.
 *
 * That is what makes it safe to reach for. A shop changing thirty prices has to
 * believe the other nine columns will come back exactly as they left, and the
 * only way to believe it is to have checked.
 *
 *   medusa exec ./src/scripts/check-bulk-export.ts
 *
 * Read-only: it plans the re-import and reports what it would do, without
 * running it.
 */
export default async function checkBulkExport({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  let pass = 0;
  let fail = 0;
  const check = (name: string, ok: boolean, extra = "") => {
    if (ok) { pass += 1; logger.info(`PASS  ${name}`); }
    else { fail += 1; logger.error(`FAIL  ${name}${extra ? `  <- ${extra}` : ""}`); }
  };

  const stock = await stockByVariant(container);
  const exported = await exportCatalogue(query, stock);

  check("the catalogue exports", exported.length > 0, `${exported.length} articles`);

  const withStock = exported.filter((product) =>
    product.colors.some((color) => color.sizes.some((size) => size.quantity > 0)),
  );
  /* The whole reason stock is read separately. Without it every row exports as
     0, and re-uploading the file would empty the shop. */
  check("stock is filled in, not zeroed", withStock.length > 0, `${withStock.length} with stock`);

  const priced = exported.filter((product) => product.price > 0);
  check("prices are filled in", priced.length === exported.length, `${priced.length}/${exported.length}`);

  const categorised = exported.filter((product) => product.categoryName);
  check("categories are filled in", categorised.length === exported.length,
    `${categorised.length}/${exported.length}`);

  /* Now the round trip: write the file, read it back the way an upload would,
     and validate it the way an upload would. */
  const file = await writeWorkbook(exported);
  const rows = await readWorkbook(file);
  const reread = parseBulkRows(rows);

  check("the file re-reads with no errors", reread.issues.length === 0,
    reread.issues.slice(0, 3).map((issue) => issue.message).join(" | "));
  check("every article survives the round trip", reread.products.length === exported.length,
    `${reread.products.length} of ${exported.length}`);

  const before = new Map(exported.map((product) => [product.sku, product]));
  const drifted = reread.products.filter((product) => {
    const original = before.get(product.sku);
    if (!original) return true;
    return (
      product.name !== original.name ||
      product.price !== original.price ||
      product.categoryName !== original.categoryName ||
      product.colors.length !== original.colors.length ||
      product.colors.reduce((sum, color) => sum + color.sizes.length, 0) !==
        original.colors.reduce((sum, color) => sum + color.sizes.length, 0)
    );
  });
  check("nothing drifts on the way back", drifted.length === 0,
    drifted.slice(0, 3).map((product) => product.sku).join(", "));

  /* And the answer to the question the shop actually cares about: if I upload
     this back without touching it, what happens? */
  const plan = planImport(reread.products, await loadExisting(query));
  check("re-uploading creates nothing", plan.counts.productsCreated === 0,
    String(plan.counts.productsCreated));
  check("re-uploading adds no variants", plan.counts.variantsCreated === 0,
    String(plan.counts.variantsCreated));
  check("re-uploading orphans nothing", plan.counts.variantsOrphaned === 0,
    String(plan.counts.variantsOrphaned));

  logger.info(
    `\n${exported.length} артикула · ${plan.counts.productsUpdated} биха се обновили без промяна`,
  );
  logger.info(`${pass} passed, ${fail} failed`);
}
