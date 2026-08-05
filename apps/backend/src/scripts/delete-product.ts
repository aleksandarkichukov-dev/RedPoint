import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { deleteProductsWorkflow } from "@medusajs/medusa/core-flows";
import type { ExecArgs } from "@medusajs/framework/types";

/**
 * Removes a product from the shop by its article number.
 *
 *   medusa exec ./src/scripts/delete-product.ts -- 67000
 *
 * Medusa soft-deletes, so this sets `deleted_at` rather than dropping rows: the
 * product leaves the shop and the admin, and any order that already contains it
 * still reads correctly. That matters — hard-deleting a product that has been
 * bought leaves an order line pointing at nothing.
 *
 * It prints what it is about to remove and refuses on an unknown article rather
 * than reporting success for having deleted nothing.
 */
export default async function deleteProduct({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  /* Stringified: the CLI hands a bare 67000 over as a number, and `external_id`
     is a text column, so Postgres rejects the comparison outright. */
  const article = args?.[0] === undefined ? null : String(args[0]);
  if (!article) {
    logger.error("give an article number: medusa exec ./src/scripts/delete-product.ts 67000");
    return;
  }

  const { data } = await query.graph({
    entity: "product",
    filters: { external_id: article },
    fields: ["id", "title", "external_id", "variants.sku", "categories.name"],
  });

  const product = data[0];
  if (!product) {
    logger.error(`no product with article ${article}`);
    return;
  }

  logger.info(
    `deleting ${product.external_id} — ${product.title} ` +
      `[${(product.categories ?? []).map((c: { name: string }) => c.name).join(", ")}] ` +
      `with ${(product.variants ?? []).length} variants`,
  );

  await deleteProductsWorkflow(container).run({ input: { ids: [product.id] } });

  logger.info(`${product.external_id} is gone from the shop`);
}
