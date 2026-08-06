import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { ExecArgs } from "@medusajs/framework/types";
import { buildPurchase } from "../modules/mypos/purchase";

/**
 * Posts one signed purchase straight to myPOS and reads what they say.
 *
 * Their checkout only ever explains itself in the rendered page, so this is the
 * fast way to find a rejected parameter — rather than walking a shopper through
 * checkout for every guess.
 *
 * One variant per run, on purpose. The config caches after its first read, so
 * swapping environment variables inside a loop changes nothing and every
 * variant silently tests the first one. Different URLs mean a different
 * process:
 *
 *   STOREFRONT_URL=https://red-point.bg medusa exec ./src/scripts/probe-mypos.ts
 *
 * Nothing is paid. A rejected form is a page; an accepted one is the card entry
 * screen, which stays untouched.
 */
export default async function probeMypos({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  const purchase = buildPurchase({
    orderId: args?.[0] ? String(args[0]) : "1042",
    itemsTotal: 19,
    deliveryTotal: 3.06,
    currency: "EUR",
    customer: {
      email: "test@example.com",
      firstName: "Тест",
      lastName: "Тестов",
      phone: "0888000000",
      city: "Варна",
      postalCode: "9000",
      address: "ул. Тестова 1",
    },
    lines: [{ name: "Тениска", quantity: 1, unitPrice: 19 }],
  });

  logger.info(`към: ${purchase.url}`);
  for (const [key, value] of Object.entries(purchase.fields)) {
    logger.info(`  ${key} = ${key === "Signature" ? String(value).slice(0,20)+"…" : value}`);
  }

  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(purchase.fields)) body.append(key, String(value));

  const response = await fetch(purchase.url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  const html = await response.text();
  const error =
    html.match(/Error Code:\s*([^<|\n]+)/i)?.[1] ??
    html.match(/Код на грешката:\s*([^<|\n]+)/i)?.[1];
  const requestId = html.match(/Request ID:\s*(\d+)/i)?.[1];

  logger.info(
    error
      ? `→ ГРЕШКА ${error.trim()}${requestId ? ` · Request ID ${requestId}` : ""}`
      : /card|карт|CVC|PAN/i.test(html)
        ? "→ ПРИЕТО — това е страницата за въвеждане на карта"
        : `→ неясен отговор, HTTP ${response.status}`,
  );
}
