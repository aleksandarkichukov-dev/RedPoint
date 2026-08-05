import { cookies } from "next/headers";
import { getRegionId, readableVariant } from "@/lib/catalog";
import { medusaFetchFresh, medusaMutate } from "@/lib/medusa";

/**
 * The cart, read and written server-side.
 *
 * The cart id lives in an httpOnly cookie rather than in localStorage. A cart
 * is the one piece of state the storefront owns before an order exists, and
 * keeping it out of reach of page scripts means a cross-site script cannot
 * read or move someone's basket. It also means every cart read happens on the
 * server, so no page ever ships a cart id to the browser.
 */

const CART_COOKIE = "rp_cart";

/** Long enough that a shopper can come back tomorrow to a basket they left. */
const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export interface CartLine {
  id: string;
  title: string;
  /** "Цвят 25 · L", already assembled for display. */
  variantTitle: string;
  thumbnail: string | null;
  productHandle: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Cart {
  id: string;
  lines: CartLine[];
  itemCount: number;
  /** Items with tax. NOT Medusa's `subtotal`, which is items plus shipping and
   *  both net of tax — a figure that matches nothing a shopper is looking at. */
  itemTotal: number;
  shippingTotal: number;
  total: number;
  currencyCode: string;
  email: string | null;
}

/** Only what the storefront renders, mirroring the `fields` asked for below. */
interface StoreCart {
  id: string;
  email: string | null;
  currency_code: string;
  item_total: number;
  shipping_total: number;
  total: number;
  items?: {
    id: string;
    title: string;
    subtitle?: string | null;
    variant_title?: string | null;
    thumbnail: string | null;
    quantity: number;
    unit_price: number;
    total: number;
    product_handle?: string | null;
    variant?: {
      title?: string | null;
      options?: { value: string; option?: { title: string } | null }[] | null;
      product?: {
        handle?: string | null;
        title?: string | null;
        metadata?: { color_names?: Record<string, string> } | null;
      } | null;
    } | null;
  }[];
}

const CART_FIELDS = [
  "id",
  "email",
  "currency_code",
  "item_total",
  "shipping_total",
  "total",
  "*items",
  "*items.variant",
  "*items.variant.options",
  "*items.variant.options.option",
  "*items.variant.product",
].join(",");

function toCart(cart: StoreCart): Cart {
  const lines: CartLine[] = (cart.items ?? []).map((item) => {
    /* Medusa's own `variant_title` is the SKU-ish composite. The shopper picked
       a colour and a size, so that is what the line says.

       The colour goes through the same rename the rest of the shop uses. The
       old site published colours as numeric ids, so the stored option value is
       still `Цвят 25` and the real name lives in product metadata. Reading the
       raw value here meant a shopper chose "черно" on the product page and
       found "Цвят 25" in their basket — the one place where a change of wording
       reads as a change of item. */
    const readable = readableVariant(
      item.variant?.options,
      item.variant?.product?.metadata?.color_names,
    );

    return {
      id: item.id,
      title: item.variant?.product?.title ?? item.title,
      variantTitle: readable || item.variant_title || "",
      thumbnail: item.thumbnail,
      productHandle: item.variant?.product?.handle ?? null,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      total: item.total,
    };
  });

  return {
    id: cart.id,
    lines,
    itemCount: lines.reduce((total, line) => total + line.quantity, 0),
    itemTotal: cart.item_total,
    shippingTotal: cart.shipping_total,
    total: cart.total,
    currencyCode: cart.currency_code,
    email: cart.email,
  };
}

export async function getCartId(): Promise<string | null> {
  return (await cookies()).get(CART_COOKIE)?.value ?? null;
}

export async function setCartId(id: string): Promise<void> {
  (await cookies()).set(CART_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CART_COOKIE_MAX_AGE,
  });
}

export async function clearCartId(): Promise<void> {
  (await cookies()).delete(CART_COOKIE);
}

/**
 * The current cart, or null when there is not one yet.
 *
 * A stale cookie — a cart completed, or wiped with the database — resolves to
 * null rather than throwing, so a shopper with an old cookie sees an empty
 * basket instead of an error page.
 */
export async function getCart(): Promise<Cart | null> {
  const id = await getCartId();
  if (!id) return null;

  try {
    const { cart } = await medusaFetchFresh<{ cart: StoreCart }>(
      `/store/carts/${id}`,
      { fields: CART_FIELDS },
    );
    return toCart(cart);
  } catch {
    return null;
  }
}

/** The current cart, creating one if this is the shopper's first line. */
export async function getOrCreateCart(): Promise<Cart> {
  const existing = await getCart();
  if (existing) return existing;

  const regionId = await getRegionId();
  const { cart } = await medusaMutate<{ cart: StoreCart }>("/store/carts", {
    body: { region_id: regionId },
    query: { fields: CART_FIELDS },
  });

  await setCartId(cart.id);
  return toCart(cart);
}

export async function addLine(variantId: string, quantity: number): Promise<Cart> {
  const cart = await getOrCreateCart();
  const { cart: updated } = await medusaMutate<{ cart: StoreCart }>(
    `/store/carts/${cart.id}/line-items`,
    { body: { variant_id: variantId, quantity }, query: { fields: CART_FIELDS } },
  );
  return toCart(updated);
}

export async function setLineQuantity(lineId: string, quantity: number): Promise<Cart | null> {
  const id = await getCartId();
  if (!id) return null;

  if (quantity <= 0) return removeLine(lineId);

  const { cart } = await medusaMutate<{ cart: StoreCart }>(
    `/store/carts/${id}/line-items/${lineId}`,
    { body: { quantity }, query: { fields: CART_FIELDS } },
  );
  return toCart(cart);
}

export async function removeLine(lineId: string): Promise<Cart | null> {
  const id = await getCartId();
  if (!id) return null;

  await medusaMutate(`/store/carts/${id}/line-items/${lineId}`, { method: "DELETE" });
  return getCart();
}
