"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { clearCartId, getCartId } from "@/lib/cart";
import {
  COD_PROVIDER,
  completeCart,
  initPaymentSession,
  setContactAndAddress,
  setShippingMethod,
} from "@/lib/checkout";

/**
 * Checkout, as server actions.
 *
 * Validation happens here and not only in the browser: a shopper with
 * JavaScript off, or a slow network that submits before the form finishes
 * hydrating, must not be able to place an order without an address.
 */

export interface CheckoutState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

const REQUIRED = {
  email: "Въведете имейл.",
  firstName: "Въведете име.",
  lastName: "Въведете фамилия.",
  phone: "Въведете телефон.",
  city: "Въведете град.",
  postalCode: "Въведете пощенски код.",
  address: "Въведете адрес.",
} as const;

export async function setDeliveryAction(optionId: string): Promise<{ ok: boolean }> {
  const cartId = await getCartId();
  if (!cartId) return { ok: false };

  try {
    await setShippingMethod(cartId, optionId);
    revalidatePath("/checkout");
    return { ok: true };
  } catch (error) {
    console.error("setDelivery failed", error);
    return { ok: false };
  }
}

export async function placeOrderAction(
  _previous: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const cartId = await getCartId();
  if (!cartId) return { error: "Количката е празна." };

  const value = (key: string) => String(formData.get(key) ?? "").trim();

  const fields = {
    email: value("email"),
    firstName: value("firstName"),
    lastName: value("lastName"),
    phone: value("phone"),
    city: value("city"),
    postalCode: value("postalCode"),
    address: value("address"),
  };

  const fieldErrors: Record<string, string> = {};
  for (const [key, message] of Object.entries(REQUIRED)) {
    if (!fields[key as keyof typeof fields]) fieldErrors[key] = message;
  }
  if (fields.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fields.email)) {
    fieldErrors.email = "Имейлът не изглежда валиден.";
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const shippingOptionId = value("shippingOptionId");
  if (!shippingOptionId) return { error: "Изберете начин на доставка." };

  const payWithCard = value("paymentMethod") === "card";

  let orderId: string;
  try {
    await setContactAndAddress(cartId, fields.email, fields);
    /* Re-applied on submit rather than trusted from the earlier click: the
       address can change the available options, and the last thing selected in
       the browser is not necessarily what the cart is carrying. */
    /* The chosen office travels with the shipping method, not beside it. It
       is part of where the parcel goes, and Medusa carries `data` on a
       shipping method through to fulfilment — which is where a waybill will
       read it. Empty for a delivery to the door. */
    await setShippingMethod(cartId, shippingOptionId, {
      officeCode: value("officeCode"),
      officeName: value("officeName"),
    });
    await initPaymentSession(cartId, COD_PROVIDER);

    const order = await completeCart(cartId);
    orderId = order.id;
  } catch (error) {
    console.error("placeOrder failed", error);
    return {
      error:
        error instanceof Error && error.message.length < 120
          ? error.message
          : "Поръчката не можа да бъде завършена. Опитайте отново.",
    };
  }

  // The cart is spent once it becomes an order; a stale cookie would show the
  // next visitor on this browser a basket they cannot check out.
  await clearCartId();

  /* Card payments detour through myPOS. The order exists first and is created
     unpaid, which is what lets myPOS echo an order number back and what leaves
     an abandoned payment visible in the admin rather than vanishing with the
     cart. The payment is recorded only when their signed notification arrives. */
  redirect(payWithCard ? `/checkout/pay/${orderId}` : `/order/${orderId}`);
}
