import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { ExecArgs } from "@medusajs/framework/types";
import { renderOrderEmail } from "../lib/order-email";
import { buildOrderEmailData } from "../lib/order-email-data";

/**
 * Prints the order confirmation email, in both languages.
 *
 *   medusa exec ./src/scripts/preview-order-email.ts          # the newest order
 *   medusa exec ./src/scripts/preview-order-email.ts -- 4     # order #4
 *
 * The local notification provider logs that it sent something but not what, and
 * the notification table stores no body, so this is how the copy and the money
 * formatting get read before a real customer does.
 *
 * It reads a real order through the same function the subscriber uses. It used
 * to render a made-up one, which proved the template and nothing else — the
 * layout looked right while the shop was still writing `Цвят 25` into the line
 * a customer reads last.
 */
export default async function previewOrderEmail({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const wanted = args?.[0] ? Number(args[0]) : null;

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "created_at"],
    ...(wanted ? { filters: { display_id: wanted } } : {}),
    pagination: { order: { created_at: "DESC" }, take: 1 },
  });

  const order = orders[0];
  if (!order) {
    logger.error(
      wanted
        ? `no order #${wanted}`
        : "no orders yet — place one in the shop first, then run this again",
    );
    return;
  }

  const built = await buildOrderEmailData(container, order.id);
  if (!built) {
    logger.error(`order ${order.id} could not be read`);
    return;
  }

  logger.info(`order #${built.data.displayId} → ${built.email ?? "(no email)"}`);

  for (const locale of ["bg", "en"] as const) {
    const email = renderOrderEmail(built.data, locale);
    logger.info(`\n===== ${locale.toUpperCase()} =====`);
    logger.info(`subject: ${email.subject}`);
    logger.info(email.text);
    logger.info(`html length: ${email.html.length} chars`);
  }
}
