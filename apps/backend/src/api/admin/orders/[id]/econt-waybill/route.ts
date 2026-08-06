import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { updateOrderWorkflow } from "@medusajs/medusa/core-flows";
import { isSandbox } from "../../../../../modules/econt/client";
import { createWaybill } from "../../../../../modules/econt/waybill";

/**
 * Issues the Econt waybill for one order.
 *
 * The only place in the shop that creates a real parcel, and it is reached by
 * one person pressing one button on one order. Everything about it is built so
 * that pressing it twice, or pressing it on the wrong order, costs nothing.
 *
 * The waybill number is written onto the order. That is what makes the second
 * press harmless: a parcel already issued is reported back rather than issued
 * again, so a slow network or a double click cannot send two couriers.
 */

interface OrderMetadata {
  econt_waybill?: string;
  econt_waybill_pdf?: string;
  [key: string]: unknown;
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const orderId = req.params.id;

  const { data } = await query.graph({
    entity: "order",
    filters: { id: orderId },
    fields: [
      "id",
      "display_id",
      "email",
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
  if (metadata.econt_waybill) {
    res.json({
      waybill: { number: metadata.econt_waybill, pdfUrl: metadata.econt_waybill_pdf ?? null },
      alreadyIssued: true,
    });
    return;
  }

  const method = order.shipping_methods?.[0];
  if (!method) {
    res.status(400).json({ message: "Поръчката няма избран начин на доставка." });
    return;
  }

  if (!/еконт/i.test(method.name ?? "")) {
    res.status(400).json({
      message: `Доставката е „${method.name}". Тази поръчка не се изпраща с Еконт.`,
    });
    return;
  }

  const address = order.shipping_address;
  if (!address) {
    res.status(400).json({ message: "Поръчката няма адрес за доставка." });
    return;
  }

  /* The office the shopper picked in checkout, carried on the shipping
     method's `data` since that is where it belongs — see the storefront. */
  const officeCode = (method.data as { officeCode?: string } | null)?.officeCode;

  /* An office delivery with no office is refused, not quietly sent to the
     door. Orders placed before the picker existed look exactly like this, and
     falling back to the street address would send a courier to somebody who
     chose to collect it themselves — a wrong parcel that arrives, which nobody
     notices until they are standing at the door. */
  if (/офис/i.test(method.name ?? "") && !officeCode) {
    res.status(400).json({
      message:
        "Поръчката е за доставка до офис, но офисът не е записан — вероятно е " +
        "отпреди избора на офис в сайта. Обадете се на клиента и издайте " +
        "товарителницата от панела на Еконт.",
    });
    return;
  }

  /* Cash on delivery only when it has not already been paid. Putting a COD
     amount on a card-paid order makes the courier collect the money twice, and
     the shopper finds out at their door. */
  const paid = order.payment_collections?.[0]?.status === "completed";

  try {
    const waybill = await createWaybill({
      receiver: {
        name: `${address.first_name ?? ""} ${address.last_name ?? ""}`.trim() || "Клиент",
        phone: address.phone ?? "",
      },
      ...(officeCode
        ? { officeCode }
        : {
            address: {
              cityName: address.city ?? "",
              street: address.address_1 ?? "",
              num: "",
            },
          }),
      ...(paid ? {} : { codAmount: Number(order.total ?? 0) }),
      reference: String(order.display_id),
    });

    await updateOrderWorkflow(req.scope).run({
      input: {
        id: order.id,
        user_id: "",
        metadata: {
          ...metadata,
          econt_waybill: waybill.number,
          econt_waybill_pdf: waybill.pdfUrl ?? undefined,
        },
      },
    });

    logger.info(
      `econt waybill ${waybill.number} issued for order ${order.display_id}` +
        (isSandbox() ? " (demo)" : " (LIVE)"),
    );

    res.json({ waybill, alreadyIssued: false });
  } catch (error) {
    /* Econt's reasons are specific and in Bulgarian — a missing phone, an
       address they cannot resolve — so the shop sees theirs rather than ours. */
    logger.error(`econt waybill failed for order ${order.display_id}: ${error}`);
    res.status(502).json({ message: (error as Error).message });
  }
}
