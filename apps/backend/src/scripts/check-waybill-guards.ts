import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { ExecArgs } from "@medusajs/framework/types";
import { isSandbox } from "../modules/econt/client";

/**
 * What the waybill button would do for each existing order, without doing it.
 *
 * The route itself needs an admin session, so this exercises the same
 * decisions against the same data: which orders it would refuse, which it
 * would treat as already issued, and which would actually create a parcel.
 *
 *   medusa exec ./src/scripts/check-waybill-guards.ts
 */
export default async function checkWaybillGuards({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  logger.info(isSandbox() ? "system: demo" : "system: LIVE");

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "metadata",
      "shipping_address.*",
      "shipping_methods.*",
      "payment_collections.status",
    ],
  });

  for (const order of orders) {
    const metadata = (order.metadata ?? {}) as Record<string, unknown>;
    const method = order.shipping_methods?.[0];
    const office = (method?.data as { officeCode?: string } | null)?.officeCode;
    const paid = order.payment_collections?.[0]?.status === "completed";

    const verdict = metadata.econt_waybill
      ? `вече издадена: ${metadata.econt_waybill}`
      : !method
        ? "ОТКАЗ — няма начин на доставка"
        : !/еконт/i.test(method.name ?? "")
          ? `ОТКАЗ — доставката е „${method.name}"`
          : /офис/i.test(method.name ?? "") && !office
            ? "ОТКАЗ — до офис, но офисът не е записан"
            : !order.shipping_address
              ? "ОТКАЗ — няма адрес"
              : `БИ СЪЗДАЛА пратка ${office ? `до офис ${office}` : "до адрес"}` +
                (paid ? ", без наложен платеж" : ", с наложен платеж");

    logger.info(`№ ${order.display_id} · ${method?.name ?? "—"} → ${verdict}`);
  }
}
