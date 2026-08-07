import { getCartId } from "@/lib/cart";
import { readableVariant } from "@/lib/catalog";
import { medusaFetchFresh, medusaMutate } from "@/lib/medusa";

/**
 * The checkout sequence, as Medusa wants it performed.
 *
 * Order matters and is not obvious: the cart needs an email and an address
 * before shipping options will price, a shipping method before a payment
 * session will initialise, and a payment session before it will complete. Each
 * step here is one call, and `placeOrder` runs them in that order.
 */

export interface ShippingOption {
  id: string;
  name: string;
  amount: number;
  /** "office" or "address", from the option's type code. */
  kind: string;
}

export interface CheckoutAddress {
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
  postalCode: string;
  address: string;
}

interface StoreShippingOption {
  id: string;
  name: string;
  amount: number;
  type?: { code?: string | null } | null;
}

export async function listShippingOptions(cartId: string): Promise<ShippingOption[]> {
  const { shipping_options } = await medusaFetchFresh<{
    shipping_options: StoreShippingOption[];
  }>("/store/shipping-options", { cart_id: cartId, fields: "id,name,amount,*type" });

  return shipping_options.map((option) => ({
    id: option.id,
    name: option.name,
    amount: option.amount,
    kind: option.type?.code ?? "address",
  }));
}

/** Which shipping method the cart already carries, if any. */
export async function getSelectedShippingOptionId(cartId: string): Promise<string | null> {
  const { cart } = await medusaFetchFresh<{
    cart: { shipping_methods?: { shipping_option_id: string }[] };
  }>(`/store/carts/${cartId}`, { fields: "id,*shipping_methods" });

  return cart.shipping_methods?.[0]?.shipping_option_id ?? null;
}

/**
 * Attaches a shipping method, and the office it goes to when there is one.
 *
 * The office rides in `data`, which Medusa carries from the shipping method
 * through to fulfilment. Keeping it on the cart's metadata instead would mean
 * whoever prints the waybill has to know to look somewhere else.
 */
export async function setShippingMethod(
  cartId: string,
  optionId: string,
  data?: { officeCode?: string; officeName?: string },
): Promise<void> {
  const office = data?.officeCode ? data : undefined;

  await medusaMutate(`/store/carts/${cartId}/shipping-methods`, {
    body: { option_id: optionId, ...(office ? { data: office } : {}) },
  });
}

/**
 * Records how the shopper meant to pay, on the cart.
 *
 * Both routes create the order identically — the same provider, the same
 * unpaid payment — and until now the only difference between them was which
 * page the browser was sent to next. Nothing on the order said which it was.
 *
 * That is what made an abandoned card payment indistinguishable from an
 * ordinary cash-on-delivery order: both sit unpaid, and one is waiting for a
 * courier while the other is waiting for nobody. The shop cannot chase the
 * second without also pestering the first.
 *
 * On the cart rather than the order, because a storefront may not write to an
 * order — and Medusa copies the cart's metadata onto the order when it
 * completes (`complete-cart`, where the order is built from `cart.metadata`).
 */
export async function setPaymentIntent(
  cartId: string,
  intent: "card" | "cod",
): Promise<void> {
  await medusaMutate(`/store/carts/${cartId}`, {
    body: { metadata: { payment_intent: intent } },
  });
}

export async function setContactAndAddress(
  cartId: string,
  email: string,
  address: CheckoutAddress,
): Promise<void> {
  const payload = {
    first_name: address.firstName,
    last_name: address.lastName,
    address_1: address.address,
    city: address.city,
    postal_code: address.postalCode,
    country_code: "bg",
    phone: address.phone,
  };

  /* Billing is set to the same address. The client sells to individuals only,
     so there is no second address to collect and no invoice to satisfy — see
     docs/client-requirements.md. */
  await medusaMutate(`/store/carts/${cartId}`, {
    body: { email, shipping_address: payload, billing_address: payload },
  });
}

/**
 * Cash on delivery, through Medusa's built-in manual provider.
 *
 * There is nothing to authorise: the courier collects. The order is created
 * unpaid and the shop marks it paid when the money arrives, which is what the
 * manual provider is for. myPOS becomes a second provider alongside this one.
 */
export const COD_PROVIDER = "pp_system_default";

export async function initPaymentSession(cartId: string, providerId: string): Promise<void> {
  const { payment_collection } = await medusaMutate<{
    payment_collection: { id: string };
  }>("/store/payment-collections", { body: { cart_id: cartId } });

  await medusaMutate(`/store/payment-collections/${payment_collection.id}/payment-sessions`, {
    body: { provider_id: providerId },
  });
}

export interface PlacedOrder {
  id: string;
  displayId: number;
  email: string;
  total: number;
}

export async function completeCart(cartId: string): Promise<PlacedOrder> {
  const result = await medusaMutate<
    | { type: "order"; order: { id: string; display_id: number; email: string; total: number } }
    | { type: "cart"; error?: { message?: string } }
  >(`/store/carts/${cartId}/complete`);

  if (result.type !== "order") {
    /* Medusa answers 200 with the cart when completion fails — a line that went
       out of stock while the shopper was typing, most often — so this is a
       real failure path and not an edge case. */
    throw new Error(result.error?.message ?? "Поръчката не можа да бъде завършена.");
  }

  return {
    id: result.order.id,
    displayId: result.order.display_id,
    email: result.order.email,
    total: result.order.total,
  };
}

export interface OrderSummary {
  id: string;
  displayId: number;
  email: string;
  total: number;
  currencyCode: string;
  lines: { id: string; title: string; variantTitle: string; quantity: number; total: number }[];
  shippingMethod: string | null;
  paymentMethod: string | null;
  address: { name: string; city: string; postalCode: string; address: string; phone: string } | null;
}

export async function getOrder(orderId: string): Promise<OrderSummary | null> {
  try {
    const { order } = await medusaFetchFresh<{ order: Record<string, any> }>(
      `/store/orders/${orderId}`,
      {
        fields:
          "id,display_id,email,total,currency_code,*items,*items.variant,*items.variant.options,*items.variant.options.option,*items.variant.product,*shipping_methods,*shipping_address,*payment_collections,*payment_collections.payments",
      },
    );

    const address = order.shipping_address;

    return {
      id: order.id,
      displayId: order.display_id,
      email: order.email,
      total: order.total,
      currencyCode: order.currency_code,
      lines: (order.items ?? []).map((item: Record<string, any>) => ({
        id: item.id,
        title: item.title,
        variantTitle: readableVariant(
          item.variant?.options,
          item.variant?.product?.metadata?.color_names,
        ),
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
            city: address.city ?? "",
            postalCode: address.postal_code ?? "",
            address: address.address_1 ?? "",
            phone: address.phone ?? "",
          }
        : null,
    };
  } catch {
    return null;
  }
}

/** The cart id, or null — checkout pages use this to bounce an empty visit. */
export { getCartId };
