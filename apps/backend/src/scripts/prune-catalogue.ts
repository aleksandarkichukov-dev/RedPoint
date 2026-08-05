import type { ExecArgs, RemoteQueryFunction } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import {
  deleteProductCategoriesWorkflow,
  deleteProductsWorkflow,
} from "@medusajs/medusa/core-flows";
import { flattenCategories } from "@redpoint/catalog";

/**
 * Removes anything in the store whose category is no longer in the shared tree.
 *
 *   pnpm --filter @redpoint/backend exec medusa exec ./src/scripts/prune-catalogue.ts
 *
 * The seed is additive by design — it creates only what is missing, so dropping
 * a branch from `@redpoint/catalog` leaves the products already in the database
 * exactly where they were. This is the other half of that: it makes the store
 * match the tree again.
 *
 * A product is deleted only when EVERY category it belongs to is going away.
 * Anything that also sits in a category we are keeping stays, with just the
 * dead category unlinked by the category delete. That distinction matters: an
 * item can be both "Разпродажба" and "Дънки", and removing the sale branch must
 * not take the jeans with it.
 *
 * Safe to re-run: with nothing stale left it reports zero and exits.
 */

type MedusaQuery = Omit<RemoteQueryFunction, symbol>;

export default async function pruneCatalogue({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve<MedusaQuery>(ContainerRegistrationKeys.QUERY);

  const validHandles = new Set(flattenCategories().map((category) => category.key));

  const { data: categories } = await query.graph({
    entity: "product_category",
    fields: ["id", "handle", "name", "parent_category_id"],
  });

  const stale = categories.filter(
    (category: { handle: string }) => !validHandles.has(category.handle),
  );
  const staleIds = new Set(stale.map((category: { id: string }) => category.id));

  if (stale.length > 0) {
    logger.info(
      `Pruning ${stale.length} categories: ${stale
        .map((category: { handle: string }) => category.handle)
        .join(", ")}`,
    );
  }

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "categories.id"],
  });

  /* A product with no surviving category at all counts too, not just one whose
     categories are on their way out. Re-running the seed after a category has
     been dropped recreates its products with nothing attached, and those are
     invisible in every listing while still being sellable by direct link. */
  const orphaned = products.filter((product: { categories?: { id: string }[] }) => {
    const owners = product.categories ?? [];
    return owners.every((category) => staleIds.has(category.id));
  });

  if (stale.length === 0 && orphaned.length === 0) {
    logger.info("Catalogue already matches the category tree. Nothing to prune.");
    return;
  }

  if (orphaned.length > 0) {
    logger.info(`Deleting ${orphaned.length} products left with no surviving category.`);
    await deleteProductsWorkflow(container).run({
      input: { ids: orphaned.map((product: { id: string }) => product.id) },
    });
  }

  if (staleIds.size === 0) {
    logger.info(`Pruned ${orphaned.length} products with no surviving category.`);
    return;
  }

  /* Deepest first. Medusa refuses to delete a category that still has children
     ("with category children is not allowed"), so removing a whole branch —
     "Жени" and the two categories under it — has to happen bottom-up, one
     level per call. */
  const parentOf = new Map<string, string | null>(
    categories.map((category: { id: string; parent_category_id: string | null }) => [
      category.id,
      category.parent_category_id,
    ]),
  );
  const depthOf = (id: string) => {
    let depth = 0;
    let current = parentOf.get(id) ?? null;
    while (current) {
      depth += 1;
      current = parentOf.get(current) ?? null;
    }
    return depth;
  };

  const byDepth = [...staleIds].sort((a, b) => depthOf(b) - depthOf(a));
  for (const depth of [...new Set(byDepth.map(depthOf))]) {
    const level = byDepth.filter((id) => depthOf(id) === depth);
    await deleteProductCategoriesWorkflow(container).run({ input: level });
  }

  logger.info(
    `Pruned ${stale.length} categories and ${orphaned.length} products. ` +
      "Product photography under static/ is left alone; it is regenerable and " +
      "harmless.",
  );
}
