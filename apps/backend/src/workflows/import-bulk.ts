import { createWorkflow, createStep, StepResponse, WorkflowResponse, transform } from "@medusajs/framework/workflows-sdk";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import {
  createProductsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows";
import { OPTION_COLOR, OPTION_SIZE, type ImportPlan, type PlannedProduct } from "../modules/bulk/plan";

/**
 * Applies an import plan, all of it or none of it.
 *
 * A Medusa workflow rather than a loop of calls, because the brief is explicit
 * that a partial import leaves the shop in an impossible state. Composing the
 * product workflows as steps means the orchestrator rolls back what already
 * succeeded when a later step fails — which a `for` loop over the same
 * workflows cannot do.
 *
 * The plan carries every decision. Nothing here chooses what to create or
 * update; it only carries it out.
 */

export interface ImportBulkInput {
  plan: ImportPlan;
  /** Medusa category id per category key from the sheet. */
  categoryIds: Record<string, string>;
  salesChannelId: string;
  shippingProfileId: string;
  currencyCode: string;
  /** Where stock is counted. One warehouse today; see the seed. */
  stockLocationId: string;
}

/** Stock is set after the variants exist, so it is its own step. */
const setInventoryStep = createStep(
  "set-bulk-inventory",
  async (
    input: { quantities: { sku: string; quantity: number }[]; stockLocationId: string },
    { container },
  ) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const inventoryModule = container.resolve(Modules.INVENTORY);

    /* Every variant, then filtered here — the same shape the seed uses and the
       same reason: a `filters: { sku: [...] }` on this entity comes back empty,
       which looks exactly like a product whose stock simply did not save. The
       catalogue is a few hundred variants, so reading them all costs nothing. */
    const { data: variants } = await query.graph({
      entity: "variant",
      fields: ["id", "sku", "inventory_items.inventory_item_id"],
    });

    const wanted = new Map(input.quantities.map((entry) => [entry.sku, entry.quantity]));
    const itemBySku = new Map<string, string>();
    for (const variant of variants) {
      if (!variant.sku || !wanted.has(variant.sku)) continue;
      const itemId = variant.inventory_items?.[0]?.inventory_item_id;
      if (itemId) itemBySku.set(variant.sku, itemId);
    }

    /* Previous levels are captured so the compensation can put them back. A
       failed import that leaves stock rewritten is exactly the impossible
       state this workflow exists to prevent. */
    const previous: { inventoryItemId: string; quantity: number }[] = [];
    const updates: { inventoryItemId: string; quantity: number }[] = [];

    for (const entry of input.quantities) {
      const itemId = itemBySku.get(entry.sku);
      if (!itemId) continue;

      const levels = await inventoryModule.listInventoryLevels({
        inventory_item_id: itemId,
        location_id: input.stockLocationId,
      });

      const level = levels[0];
      if (level) {
        previous.push({ inventoryItemId: itemId, quantity: Number(level.stocked_quantity) });
        await inventoryModule.updateInventoryLevels([
          {
            inventory_item_id: itemId,
            location_id: input.stockLocationId,
            stocked_quantity: entry.quantity,
          },
        ]);
      } else {
        await inventoryModule.createInventoryLevels([
          {
            inventory_item_id: itemId,
            location_id: input.stockLocationId,
            stocked_quantity: entry.quantity,
          },
        ]);
      }
      updates.push({ inventoryItemId: itemId, quantity: entry.quantity });
    }

    return new StepResponse(
      { updated: updates.length },
      { previous, stockLocationId: input.stockLocationId },
    );
  },
  async (compensation, { container }) => {
    if (!compensation) return;
    const inventoryModule = container.resolve(Modules.INVENTORY);
    for (const level of compensation.previous) {
      await inventoryModule.updateInventoryLevels([
        {
          inventory_item_id: level.inventoryItemId,
          location_id: compensation.stockLocationId,
          stocked_quantity: level.quantity,
        },
      ]);
    }
  },
);

/** Only what shaping a product needs; the location belongs to the stock step. */
type CreateContext = Pick<
  ImportBulkInput,
  "categoryIds" | "salesChannelId" | "shippingProfileId" | "currencyCode"
>;

function toCreateInput(product: PlannedProduct, context: CreateContext) {
  return {
    title: product.name,
    handle: undefined,
    external_id: product.sku,
    status: "published" as const,
    description: product.description ?? undefined,
    material: product.material ?? undefined,
    category_ids: context.categoryIds[product.categoryKey]
      ? [context.categoryIds[product.categoryKey]!]
      : [],
    shipping_profile_id: context.shippingProfileId,
    sales_channels: [{ id: context.salesChannelId }],
    options: [
      { title: OPTION_COLOR, values: product.colors },
      { title: OPTION_SIZE, values: product.sizes },
    ],
    metadata: {
      article_no: product.sku,
      compare_at_eur: product.compareAtPrice,
    },
    variants: product.variants.map((variant) => ({
      title: variant.title,
      sku: variant.sku,
      manage_inventory: true,
      options: { [OPTION_COLOR]: variant.color, [OPTION_SIZE]: variant.size },
      prices: [{ amount: variant.price, currency_code: context.currencyCode }],
      metadata: { article_no: product.sku },
    })),
  };
}

export const importBulkWorkflow = createWorkflow(
  "import-bulk-catalogue",
  (input: ImportBulkInput) => {
    const created = createProductsWorkflow.runAsStep({
      input: transform({ input }, ({ input: data }) => ({
        products: data.plan.create.map((product) =>
          toCreateInput(product, {
            categoryIds: data.categoryIds,
            salesChannelId: data.salesChannelId,
            shippingProfileId: data.shippingProfileId,
            currencyCode: data.currencyCode,
          }),
        ),
      })),
    });

    /* Only the product-level fields are updated. Adding or removing variants on
       an existing article is a bigger change than a daily stock sheet should
       make silently, and the plan reports the ones that fell out instead. */
    updateProductsWorkflow.runAsStep({
      input: transform({ input }, ({ input: data }) => ({
        products: data.plan.update.map((product) => ({
          id: product.existingProductId!,
          title: product.name,
          description: product.description ?? undefined,
          material: product.material ?? undefined,
          category_ids: data.categoryIds[product.categoryKey]
            ? [data.categoryIds[product.categoryKey]!]
            : [],
          metadata: {
            article_no: product.sku,
            compare_at_eur: product.compareAtPrice,
          },
        })),
      })),
    });

    const inventory = setInventoryStep(
      transform({ input }, ({ input: data }) => ({
        quantities: [...data.plan.create, ...data.plan.update].flatMap((product) =>
          product.variants.map((variant) => ({
            sku: variant.sku,
            quantity: variant.quantity,
          })),
        ),
        stockLocationId: data.stockLocationId,
      })),
    );

    return new WorkflowResponse({ created, inventory });
  },
);
