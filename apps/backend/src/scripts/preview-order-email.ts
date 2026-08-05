import type { ExecArgs } from "@medusajs/framework/types";
import { renderOrderEmail } from "../lib/order-email";

/**
 * Prints the order confirmation email for a made-up order, in both languages.
 *
 *   pnpm --filter @redpoint/backend exec medusa exec ./src/scripts/preview-order-email.ts
 *
 * The local notification provider logs that it sent something but not what, and
 * the notification table stores no body, so this is how the copy and the money
 * formatting get read before a real customer does.
 */
export default async function previewOrderEmail({ container }: ExecArgs) {
  const logger = container.resolve("logger");

  const sample = {
    displayId: 1042,
    itemTotal: 74,
    shippingTotal: 2.55,
    total: 76.55,
    lines: [
      { title: "Тъмносиньо спортно-техническо яке", variant: "синьо · L", quantity: 1, total: 37 },
      { title: "Дънки в по-светъл деним", variant: "синьо · 31", quantity: 1, total: 37 },
    ],
    shippingMethod: "Еконт - до офис",
    paymentMethod: "Наложен платеж",
    address: {
      name: "Иван Петров",
      phone: "0888123456",
      city: "Варна",
      postalCode: "9000",
      address: "ул. Дунав 5",
    },
    storeUrl: "https://red-point.bg",
  };

  for (const locale of ["bg", "en"] as const) {
    const email = renderOrderEmail(sample, locale);
    logger.info(`\n===== ${locale.toUpperCase()} =====`);
    logger.info(`subject: ${email.subject}`);
    logger.info(email.text);
    logger.info(`html length: ${email.html.length} chars`);
  }
}
