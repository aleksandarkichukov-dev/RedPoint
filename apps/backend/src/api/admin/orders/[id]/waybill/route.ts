import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { updateOrderWorkflow } from "@medusajs/medusa/core-flows";
import { isSandbox } from "../../../../../modules/econt/client";
import { createWaybill } from "../../../../../modules/econt/waybill";
import { createShipment, resolveAddress } from "../../../../../modules/speedy/shipment";

/**
 * Issues the waybill for one order, with whichever courier it was ordered for.
 *
 * One route for both, because the decision it makes is the same either way and
 * two routes would answer "may this parcel be created" in two slightly
 * different ways within a month. Which courier comes from the shipping
 * method's name — the one string the shopper, the order and this button all
 * see.
 *
 * The only place in the shop that creates a real parcel, reached by one person
 * pressing one button on one order. Everything about it is built so that
 * pressing it twice, or pressing it on the wrong order, costs nothing.
 */

interface OrderMetadata {
  waybill?: string;
  waybill_courier?: string;
  waybill_pdf?: string;
  /* Written by the earlier Econt-only version. Read so orders issued before
     this route keep showing their number instead of offering to send a second
     parcel. */
  econt_waybill?: string;
  econt_waybill_pdf?: string;
  [key: string]: unknown;
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const { data } = await query.graph({
    entity: "order",
    filters: { id: req.params.id },
    fields: [
      "id",
      "display_id",
      "metadata",
      "total",
      "shipping_address.*",
      "shipping_methods.*",
      "payment_collections.status",
    ],
  });

  const order = data[0];
  if (!order) {
    res.status(404).json({ message: "Няма такава поръчка." });
    return;
  }

  const metadata = (order.metadata ?? {}) as OrderMetadata;
  const existing = metadata.waybill ?? metadata.econt_waybill;
  if (existing) {
    res.json({
      waybill: {
        number: existing,
        courier: metadata.waybill_courier ?? "econt",
        pdfUrl: metadata.waybill_pdf ?? metadata.econt_waybill_pdf ?? null,
      },
      alreadyIssued: true,
    });
    return;
  }

  const method = order.shipping_methods?.[0];
  if (!method) {
    res.status(400).json({ message: "Поръчката няма избран начин на доставка." });
    return;
  }

  const name = method.name ?? "";
  const courier = /еконт/i.test(name) ? "econt" : /спиди/i.test(name) ? "speedy" : null;
  if (!courier) {
    res.status(400).json({
      message: `Доставката е „${name}". Не разпознавам куриер, с който да се изпрати.`,
    });
    return;
  }

  const address = order.shipping_address;
  if (!address) {
    res.status(400).json({ message: "Поръчката няма адрес за доставка." });
    return;
  }

  const officeCode = (method.data as { officeCode?: string } | null)?.officeCode;

  /* An office delivery with no office is refused, not quietly sent to the door.
     Orders placed before the picker existed look exactly like this, and falling
     back to the street address would send a courier to somebody who chose to
     collect it themselves — a wrong parcel that arrives, which nobody notices
     until they are standing at the door. */
  if (/офис/i.test(name) && !officeCode) {
    res.status(400).json({
      message:
        "Поръчката е за доставка до офис, но офисът не е записан — вероятно е " +
        "отпреди избора на офис в сайта. Обадете се на клиента и издайте " +
        "товарителницата от панела на куриера.",
    });
    return;
  }

  /* Cash on delivery only when it has not already been paid. Putting a COD
     amount on a card-paid order makes the courier collect the money twice, and
     the shopper finds out at their door. */
  const paid = order.payment_collections?.[0]?.status === "completed";
  const receiver = {
    name: `${address.first_name ?? ""} ${address.last_name ?? ""}`.trim() || "Клиент",
    phone: address.phone ?? "",
  };
  const codAmount = paid ? undefined : Number(order.total ?? 0);
  const reference = String(order.display_id);

  try {
    let number: string;
    let pdfUrl: string | null = null;

    if (courier === "econt") {
      const waybill = await createWaybill({
        receiver,
        ...(officeCode
          ? { officeCode }
          : { address: { cityName: address.city ?? "", street: address.address_1 ?? "", num: "" } }),
        ...(codAmount ? { codAmount } : {}),
        reference,
      });
      number = waybill.number;
      pdfUrl = waybill.pdfUrl;
    } else {
      const shipment = await createShipment({
        receiver,
        ...(officeCode
          ? { officeId: Number(officeCode) }
          : { address: await resolveAddress(address.city ?? "", address.address_1 ?? "") }),
        ...(codAmount ? { codAmount } : {}),
        reference,
      });
      number = shipment.number;
    }

    await updateOrderWorkflow(req.scope).run({
      input: {
        id: order.id,
        user_id: "",
        metadata: {
          ...metadata,
          waybill: number,
          waybill_courier: courier,
          waybill_pdf: pdfUrl ?? undefined,
        },
      },
    });

    logger.info(
      `${courier} waybill ${number} issued for order ${order.display_id}` +
        (courier === "econt" && isSandbox() ? " (demo)" : " (LIVE)"),
    );

    res.json({ waybill: { number, courier, pdfUrl }, alreadyIssued: false });
  } catch (error) {
    /* The courier's own reason, in Bulgarian, rather than ours. A missing
       phone or an address they cannot resolve is something the shop can fix;
       "something went wrong" is not. */
    logger.error(`${courier} waybill failed for order ${order.display_id}: ${error}`);
    res.status(502).json({ message: (error as Error).message });
  }
}
