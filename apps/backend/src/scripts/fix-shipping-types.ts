import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import type { ExecArgs } from "@medusajs/framework/types";

/**
 * Repairs the office/address code on the shipping options.
 *
 * Checkout decides whether to show the office picker from the shipping
 * option's type code. These options were created before those codes existed,
 * so three of the four sat on `standard` while the seed file said otherwise —
 * and the picker silently never appeared. The file and the database disagreed,
 * with nothing anywhere to make that visible.
 *
 * `updateShippingOptionsWorkflow` accepts a `type` and does not apply it, so
 * this goes through the fulfillment module directly.
 *
 *   medusa exec ./src/scripts/fix-shipping-types.ts
 */
const CODE_BY_NAME: Record<string, string> = {
  "Спиди - до офис": "office",
  "Еконт - до офис": "office",
  "Спиди - до адрес": "address",
  "Еконт - до адрес": "address",
};

export default async function fixShippingTypes({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const fulfillment = container.resolve(Modules.FULFILLMENT);

  const { data: options } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name", "type.id", "type.code"],
  });

  let fixed = 0;

  for (const option of options) {
    const wanted = CODE_BY_NAME[option.name];
    if (!wanted || !option.type?.id) continue;

    if (option.type.code === wanted) {
      logger.info(`${option.name} is already ${wanted}`);
      continue;
    }

    await fulfillment.updateShippingOptionTypes(option.type.id, {
      label: option.name,
      description: option.name,
      code: wanted,
    });

    logger.info(`${option.name}: ${option.type.code} → ${wanted}`);
    fixed += 1;
  }

  logger.info(fixed > 0 ? `${fixed} shipping options repaired` : "nothing to repair");
}
