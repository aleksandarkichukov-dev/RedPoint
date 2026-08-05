import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { renderOrderEmail, type Locale, type OrderEmailData } from "../lib/order-email";

/**
 * Sends the order confirmation when an order is placed.
 *
 * A subscriber rather than a step inside the checkout workflow: the email is
 * not part of taking the order, and a mail provider being down for a minute
 * must not turn a paid order into a failed one. Medusa retries the subscriber
 * on its own.
 */

const COD_PROVIDER = "pp_system_default";

export default async function orderPlacedHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const notification = container.resolve(Modules.NOTIFICATION);

  const { data } = await query.graph({
    entity: "order",
    filters: { id: event.data.id },
    fields: [
      "id",
      "display_id",
      "email",
      "item_total",
      "shipping_total",
      "total",
      "items.id",
      "items.title",
      "items.quantity",
      "items.total",
      "items.variant.options.value",
      "shipping_methods.name",
      "shipping_address.*",
      "payment_collections.payments.provider_id",
    ],
  });

  const order = data[0];
  if (!order?.email) {
    logger.warn(`order.placed for ${event.data.id} has no email; nothing sent`);
    return;
  }

  const address = order.shipping_address;

  const payload: OrderEmailData = {
    displayId: order.display_id,
    itemTotal: order.item_total,
    shippingTotal: order.shipping_total,
    total: order.total,
    lines: (order.items ?? []).map((item: Record<string, any>) => ({
      title: item.title,
      variant: (item.variant?.options ?? [])
        .map((option: { value: string }) => option.value)
        .join(" · "),
      quantity: item.quantity,
      total: item.total,
    })),
    shippingMethod: order.shipping_methods?.[0]?.name ?? null,
    paymentMethod:
      order.payment_collections?.[0]?.payments?.[0]?.provider_id === COD_PROVIDER
        ? "Наложен платеж"
        : null,
    address: address
      ? {
          name: `${address.first_name ?? ""} ${address.last_name ?? ""}`.trim(),
          phone: address.phone ?? "",
          city: address.city ?? "",
          postalCode: address.postal_code ?? "",
          address: address.address_1 ?? "",
        }
      : null,
    storeUrl: process.env.STOREFRONT_URL || "http://localhost:3000",
  };

  /* Bulgarian until there is something to read a preference from. The shop is
     Bulgarian first and the storefront has no English routes yet; when Phase 9
     adds them, the locale travels on the cart and arrives here instead of
     being assumed. */
  const locale: Locale = "bg";
  const email = renderOrderEmail(payload, locale);

  await notification.createNotifications({
    to: order.email,
    channel: "email",
    template: "order-placed",
    content: {
      subject: email.subject,
      html: email.html,
      text: email.text,
    },
    data: { order_id: order.id, display_id: order.display_id },
  });

  logger.info(`order confirmation queued for ${order.email} (order ${order.display_id})`);
}

export const config: SubscriberConfig = {
  event: "order.placed",
};
