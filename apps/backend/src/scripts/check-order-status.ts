import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { ExecArgs } from "@medusajs/framework/types";

/** Throwaway: which status fields an order actually answers with. */
export default async function checkOrderStatus({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  for (const fields of [
    ["id", "display_id", "status", "payment_status", "fulfillment_status"],
    ["id", "display_id", "status", "fulfillments.*"],
    ["id", "display_id", "status", "payment_collections.status", "shipping_methods.*"],
  ]) {
    try {
      const { data } = await query.graph({
        entity: "order",
        fields,
        pagination: { order: { created_at: "DESC" }, take: 1 },
      });
      const order = data[0] as Record<string, unknown>;
      logger.info(
        `${fields.join(",")}\n   → ${JSON.stringify(
          Object.fromEntries(
            Object.entries(order ?? {}).map(([key, value]) => [
              key,
              Array.isArray(value) ? `[${value.length}]` : value,
            ]),
          ),
        ).slice(0, 300)}`,
      );
    } catch (error) {
      logger.info(`${fields.join(",")}\n   → ГРЕШКА ${(error as Error).message}`);
    }
  }
}
