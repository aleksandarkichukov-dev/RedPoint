import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { buildPurchase } from "../../../../modules/mypos/purchase";

/**
 * Hands the storefront a signed myPOS purchase form for one order.
 *
 * The signing lives here because the private key does, and it never leaves the
 * backend. The storefront asks for the fields and renders them; it cannot
 * produce them.
 *
 * Reachable by order id and nothing else, which is the same exposure the order
 * confirmation page already has — a ULID nobody can guess, carrying only the
 * shopper's own details. Deliberately refuses an order that is already paid, so
 * a replayed link cannot start a second payment for the same goods.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const orderId = (req.body as { order_id?: string })?.order_id;
  if (!orderId) {
    res.status(400).json({ message: "order_id is required" });
    return;
  }

  const { data } = await query.graph({
    entity: "order",
    filters: { id: orderId },
    /* `items.*` rather than naming the columns. Asking for `items.unit_price`
       by name returns the row with the field null, which surfaces much later
       as "null is not an amount" from inside the request builder. */
    fields: [
      "id",
      "display_id",
      "email",
      "currency_code",
      "item_total",
      "shipping_total",
      "items.*",
      "shipping_address.*",
      "payment_collections.status",
    ],
  });

  const order = data[0];
  if (!order) {
    res.status(404).json({ message: "order not found" });
    return;
  }

  const alreadyPaid = (order.payment_collections ?? []).some(
    (collection: { status?: string }) => collection.status === "completed",
  );
  if (alreadyPaid) {
    res.status(409).json({ message: "order is already paid" });
    return;
  }

  const address = order.shipping_address;

  try {
    const purchase = buildPurchase({
      /* The display id, not the ULID: this is what myPOS echo back and what
         the shop reads off a statement, and it is what a human can match to an
         order without a database. */
      orderId: String(order.display_id),
      itemsTotal: order.item_total,
      deliveryTotal: order.shipping_total,
      currency: order.currency_code,
      lines: (order.items ?? []).map((item: Record<string, any>) => ({
        name: item.title,
        quantity: item.quantity,
        unitPrice: item.unit_price,
      })),
      customer: {
        email: order.email,
        firstName: address?.first_name ?? "",
        lastName: address?.last_name ?? "",
        phone: address?.phone ?? "",
        city: address?.city ?? "",
        postalCode: address?.postal_code ?? "",
        address: address?.address_1 ?? "",
      },
    });

    logger.info(`myPOS purchase built for order ${order.display_id}`);
    res.status(200).json(purchase);
  } catch (error) {
    logger.error(`myPOS purchase could not be built for order ${order.display_id}: ${error}`);
    res.status(500).json({ message: "payment is not available" });
  }
}
