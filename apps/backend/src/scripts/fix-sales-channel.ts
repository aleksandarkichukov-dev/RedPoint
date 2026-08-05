import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { linkProductsToSalesChannelWorkflow } from "@medusajs/medusa/core-flows";
import type { ExecArgs } from "@medusajs/framework/types";

/**
 * Moves products into the shop's own sales channel.
 *
 * A fresh Medusa install carries a "Default Sales Channel" beside the seeded
 * one, and the storefront's publishable key is bound to the seeded one. An
 * import that picked the first channel it found put products in the channel
 * nobody reads: present and published in the admin, absent from the shop, with
 * nothing anywhere reporting a problem.
 *
 * The import no longer does that. This repairs what it already did, and is
 * safe to run at any time — a product already in the right channel is left
 * alone, and nothing is ever removed from a channel.
 *
 *   pnpm --filter @redpoint/backend exec medusa exec src/scripts/fix-sales-channel.ts
 */
export default async function fixSalesChannel({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const { data: stores } = await query.graph({
    entity: "store",
    fields: ["default_sales_channel_id"],
  });
  const storeChannelId = stores[0]?.default_sales_channel_id as string | undefined;

  if (!storeChannelId) {
    logger.error("the store has no default sales channel — run the seed first");
    return;
  }

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "external_id", "title", "sales_channels.id", "sales_channels.name"],
  });

  const stranded = products.filter(
    (product: { sales_channels?: { id: string }[] }) =>
      !(product.sales_channels ?? []).some((channel) => channel.id === storeChannelId),
  );

  if (stranded.length === 0) {
    logger.info("every product is already in the shop's sales channel");
    return;
  }

  for (const product of stranded) {
    logger.info(`${product.external_id ?? product.id} — ${product.title}`);
  }

  await linkProductsToSalesChannelWorkflow(container).run({
    input: {
      id: storeChannelId,
      add: stranded.map((product: { id: string }) => product.id),
    },
  });

  logger.info(`${stranded.length} products moved into the shop's sales channel`);
}
