import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { MedusaContainer } from "@medusajs/framework/types";
import type { OrderEmailData } from "./order-email";

/**
 * Turns a placed order into the shape the confirmation email renders.
 *
 * Shared by the subscriber that sends it and the script that previews it. The
 * local notification provider logs that it sent something but not what, and the
 * notification table stores no body — so the preview is the only way to read a
 * real email, and it is worth nothing if it assembles its own version of the
 * data. Same function, same result.
 */

const COD_PROVIDER = "pp_system_default";

/**
 * `shipping_methods.*` and `items.*`, not the individual columns.
 *
 * An order's totals are computed, and computing them needs the shipping
 * method's `version` to resolve its adjustments. Ask for `shipping_methods.name`
 * and the version never loads: depending on what else is in the selection the
 * query either throws "Shipping method version is required to load adjustments"
 * or — worse — returns the order with every total quietly undefined. The email
 * then renders as "0,00 €" and "x undefined", which is what a customer was
 * being sent, and it took reading a real order to see it because the preview
 * ran on made-up numbers.
 *
 * `items.total` behaves the same way, so the lines take the star too.
 */
const ORDER_FIELDS = [
  "id",
  "display_id",
  "email",
  "item_total",
  "shipping_total",
  "total",
  "items.*",
  "items.variant.options.value",
  "items.variant.options.option.title",
  "items.variant.product.metadata",
  "shipping_methods.*",
  "shipping_address.*",
  "payment_collections.payments.provider_id",
];

/**
 * Medusa returns money as BigNumber, which formats as a 20-decimal string and
 * has no `toFixed`. Coerced once here, at the boundary, so nothing downstream
 * has to know.
 */
function money(value: unknown): number {
  return Number(value ?? 0);
}

export async function buildOrderEmailData(
  container: MedusaContainer,
  orderId: string,
): Promise<{ email: string | null; data: OrderEmailData } | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const { data } = await query.graph({
    entity: "order",
    filters: { id: orderId },
    fields: ORDER_FIELDS,
  });

  const order = data[0];
  if (!order) return null;

  const address = order.shipping_address;

  return {
    email: order.email ?? null,
    data: {
      displayId: order.display_id,
      itemTotal: money(order.item_total),
      shippingTotal: money(order.shipping_total),
      total: money(order.total),
      lines: (order.items ?? []).map((item: Record<string, any>) => ({
        title: item.title,
        variant: variantText(item),
        quantity: Number(item.quantity ?? 0),
        total: money(item.total),
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
    },
  };
}

/**
 * "черно · S".
 *
 * The colour goes through the same rename the shop applies everywhere else. The
 * old site published colours as numeric ids, so the stored option value is still
 * `Цвят 25` for migrated products, and a confirmation email is the last place a
 * shopper should meet a name they have never seen.
 */
function variantText(item: Record<string, any>): string {
  const colorNames = item.variant?.product?.metadata?.color_names as
    | Record<string, string>
    | undefined;

  return (item.variant?.options ?? [])
    .map((option: { value: string; option?: { title?: string } }) =>
      option.option?.title === "Цвят" ? (colorNames?.[option.value] ?? option.value) : option.value,
    )
    .join(" · ");
}
