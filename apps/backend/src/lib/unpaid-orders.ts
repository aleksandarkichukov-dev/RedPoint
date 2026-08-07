import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { MedusaContainer } from "@medusajs/framework/types";

/**
 * Which orders were meant to be paid by card and never were.
 *
 * Shared by the admin route and the check script, so what the screen shows and
 * what a test asserts cannot drift apart. The same reason `order-email-data`
 * exists.
 */

/** Younger than this and the shopper may still be typing their card details. */
export const GRACE_MINUTES = 30;

export interface AbandonedOrder {
  id: string;
  displayId: number;
  email: string;
  createdAt: string;
  total: number;
  currencyCode: string;
  name: string;
  phone: string | null;
}

export async function findAbandonedCardOrders(
  container: MedusaContainer,
  now = Date.now(),
): Promise<AbandonedOrder[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const { data } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "created_at",
      "status",
      /* The order's own version, which is what resolves the adjustments on its
         shipping method. Without it the query throws rather than returning a
         partial answer. */
      "version",
      "total",
      "currency_code",
      "metadata",
      "shipping_address.phone",
      "shipping_address.first_name",
      "shipping_address.last_name",
      /* Totals are computed, and computing them resolves the adjustments on
         both the shipping method and the line items — each of which needs its
         own version. Both wildcards are required together: asking for `total`
         with only one of them throws "Shipping method version is required to
         load adjustments", and asking for a single named field instead returns
         every total as undefined without a word. */
      "shipping_methods.*",
      "items.*",
      "payment_collections.status",
    ],
    pagination: { order: { created_at: "DESC" }, take: 200 },
  });

  const cutoff = now - GRACE_MINUTES * 60 * 1000;

  return data
    .filter((order: Record<string, any>) => isAbandoned(order, cutoff))
    .map((order: Record<string, any>) => ({
      id: order.id,
      displayId: order.display_id,
      email: order.email,
      createdAt: order.created_at,
      total: Number(order.total ?? 0),
      currencyCode: order.currency_code,
      name: `${order.shipping_address?.first_name ?? ""} ${order.shipping_address?.last_name ?? ""}`.trim(),
      phone: order.shipping_address?.phone ?? null,
    }));
}

/**
 * The decision itself, on one order.
 *
 * Cash on delivery is excluded because a cash order is unpaid by design until
 * the courier hands it over. Listing those would bury the four that matter
 * under forty that do not, and the shop would stop looking.
 *
 * An order with no `payment_intent` counts as cash. Everything placed before
 * checkout started recording it is in that state, and treating an unknown as a
 * card order would open this screen on a list of ordinary orders and teach the
 * shop that the screen is wrong.
 */
export function isAbandoned(order: Record<string, any>, cutoff: number): boolean {
  if (order.status === "canceled") return false;
  if ((order.metadata?.payment_intent ?? "cod") !== "card") return false;
  if (order.payment_collections?.[0]?.status === "completed") return false;
  return new Date(order.created_at).getTime() < cutoff;
}
