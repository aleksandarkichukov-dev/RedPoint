import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import type { MedusaContainer } from "@medusajs/framework/types";

/**
 * How many of each variant the shop has, in one pass.
 *
 * `inventory_quantity` is what every Medusa example asks for and `query.graph`
 * does not return it — the field is simply absent from the result, so a naive
 * read gets `undefined` and writes 0 into every row of the export. A catalogue
 * downloaded like that and uploaded back would zero the whole shop's stock.
 *
 * So the numbers come from the inventory module, and the link from a variant to
 * its inventory item comes from the graph. Two reads for the whole catalogue
 * rather than two per row.
 */
export async function stockByVariant(container: MedusaContainer): Promise<Map<string, number>> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const inventoryModule = container.resolve(Modules.INVENTORY);

  const { data: variants } = await query.graph({
    entity: "variant",
    fields: ["id", "inventory_items.inventory_item_id"],
  });

  const itemByVariant = new Map<string, string>();
  for (const variant of variants) {
    const itemId = variant.inventory_items?.[0]?.inventory_item_id;
    if (itemId) itemByVariant.set(variant.id, itemId);
  }

  if (itemByVariant.size === 0) return new Map();

  const levels = await inventoryModule.listInventoryLevels({
    inventory_item_id: [...new Set(itemByVariant.values())],
  });

  /* Summed across locations. One warehouse today, but a shop with three
     counters is exactly the kind that opens a second, and a total is what the
     sheet means by "Количество" either way. */
  const quantityByItem = new Map<string, number>();
  for (const level of levels) {
    const current = quantityByItem.get(level.inventory_item_id) ?? 0;
    quantityByItem.set(level.inventory_item_id, current + Number(level.stocked_quantity ?? 0));
  }

  const byVariant = new Map<string, number>();
  for (const [variantId, itemId] of itemByVariant) {
    byVariant.set(variantId, quantityByItem.get(itemId) ?? 0);
  }

  return byVariant;
}
