import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { ExecArgs } from "@medusajs/framework/types";
import { isSandbox } from "../modules/econt/client";
import { resolveAddress as resolveSpeedyAddress } from "../modules/speedy/shipment";

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
    const issued = metadata.waybill ?? metadata.econt_waybill;
    const method = order.shipping_methods?.[0];
    const office = (method?.data as { officeCode?: string } | null)?.officeCode;
    const paid = order.payment_collections?.[0]?.status === "completed";

    const verdict = issued
      ? `вече издадена: ${issued}`
      : !method
        ? "ОТКАЗ — няма начин на доставка"
        : !/еконт|спиди/i.test(method.name ?? "")
          ? `ОТКАЗ — доставката е „${method.name}"`
          : /офис/i.test(method.name ?? "") && !office
            ? "ОТКАЗ — до офис, но офисът не е записан"
            : !order.shipping_address
              ? "ОТКАЗ — няма адрес"
              : `БИ СЪЗДАЛА пратка ${office ? `до офис ${office}` : "до адрес"}` +
                (paid ? ", без наложен платеж" : ", с наложен платеж");

    const courier = /еконт/i.test(method?.name ?? "")
      ? "Еконт"
      : /спиди/i.test(method?.name ?? "")
        ? "Спиди"
        : "—";

    logger.info(`№ ${order.display_id} · ${courier} · ${method?.name ?? "—"} → ${verdict}`);

    /* For a Speedy parcel going to a door, the typed address has to become a
       settlement id and a street id before it can be sent. That resolution can
       fail on a real order, and finding out at the moment somebody presses the
       button is the worst time — so it is attempted here, read-only. */
    if (courier === "Спиди" && !office && verdict.startsWith("БИ СЪЗДАЛА")) {
      const address = order.shipping_address;
      try {
        const resolved = await resolveSpeedyAddress(address?.city ?? "", address?.address_1 ?? "");
        logger.info(
          `      адресът се разчита: населено място ${resolved.siteId}, улица ${resolved.streetId}, № ${resolved.streetNo}`,
        );
      } catch (error) {
        logger.warn(`      адресът НЕ се разчита: ${(error as Error).message}`);
      }
    }
  }
}
