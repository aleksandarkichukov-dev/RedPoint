import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { updateOrderWorkflow } from "@medusajs/medusa/core-flows";
import type { ExecArgs } from "@medusajs/framework/types";

/**
 * Forgets the waybill recorded on an order.
 *
 * For the case the admin has no button for: a waybill cancelled at Econt while
 * the order still carries its number, which would otherwise show a dead parcel
 * as the live one and block re-issuing it.
 *
 *   medusa exec ./src/scripts/clear-waybill.ts 5
 */
export default async function clearWaybill({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const wanted = args?.[0] === undefined ? null : Number(args[0]);
  if (!wanted) {
    logger.error("give an order number: medusa exec ./src/scripts/clear-waybill.ts 5");
    return;
  }

  const { data } = await query.graph({
    entity: "order",
    filters: { display_id: wanted },
    fields: ["id", "display_id", "metadata"],
  });

  const order = data[0];
  if (!order) {
    logger.error(`no order № ${wanted}`);
    return;
  }

  const metadata = (order.metadata ?? {}) as Record<string, unknown>;
  const had = metadata.econt_waybill;
  if (!had) {
    logger.info(`order № ${wanted} carries no waybill`);
    return;
  }

  /* Set to null, not deleted. `updateOrderWorkflow` MERGES metadata rather than
     replacing it, so sending the object without a key leaves the old value
     exactly where it was — and reports success. Null is what removes it. */
  await updateOrderWorkflow(container).run({
    input: {
      id: order.id,
      user_id: "",
      metadata: { econt_waybill: null, econt_waybill_pdf: null },
    },
  });

  logger.info(`order № ${wanted}: forgot waybill ${had}`);
}
