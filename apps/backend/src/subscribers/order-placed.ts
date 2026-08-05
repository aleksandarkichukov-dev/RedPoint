import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { renderOrderEmail, type Locale } from "../lib/order-email";
import { buildOrderEmailData } from "../lib/order-email-data";

/**
 * Sends the order confirmation when an order is placed.
 *
 * A subscriber rather than a step inside the checkout workflow: the email is
 * not part of taking the order, and a mail provider being down for a minute
 * must not turn a paid order into a failed one. Medusa retries the subscriber
 * on its own.
 */
export default async function orderPlacedHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const notification = container.resolve(Modules.NOTIFICATION);

  const built = await buildOrderEmailData(container, event.data.id);
  if (!built?.email) {
    logger.warn(`order.placed for ${event.data.id} has no email; nothing sent`);
    return;
  }

  /* Bulgarian until there is something to read a preference from. The shop is
     Bulgarian first and the storefront has no English routes yet; when Phase 9
     adds them, the locale travels on the cart and arrives here instead of
     being assumed. */
  const locale: Locale = "bg";
  const email = renderOrderEmail(built.data, locale);

  await notification.createNotifications({
    to: built.email,
    channel: "email",
    template: "order-placed",
    content: {
      subject: email.subject,
      html: email.html,
      text: email.text,
    },
    data: { order_id: event.data.id, display_id: built.data.displayId },
  });

  logger.info(`order confirmation queued for ${built.email} (order ${built.data.displayId})`);
}

export const config: SubscriberConfig = {
  event: "order.placed",
};
