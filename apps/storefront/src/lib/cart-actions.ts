"use server";

import { revalidatePath } from "next/cache";
import { addLine, removeLine, setLineQuantity } from "@/lib/cart";

/**
 * Cart mutations, as server actions.
 *
 * The client never talks to Medusa directly: the publishable key and the cart
 * id both stay on the server, and a page only ever receives the rendered cart.
 *
 * Every action returns a result rather than throwing, because these run from a
 * button on a product page — a backend hiccup should say so under the button,
 * not replace the page the shopper was reading with an error screen.
 */

export interface CartActionResult {
  ok: boolean;
  itemCount?: number;
  error?: string;
}

const GENERIC_ERROR = "Нещо се обърка. Опитайте отново.";

export async function addToCartAction(
  variantId: string,
  quantity = 1,
): Promise<CartActionResult> {
  try {
    const cart = await addLine(variantId, quantity);
    revalidatePath("/cart");
    return { ok: true, itemCount: cart.itemCount };
  } catch (error) {
    console.error("addToCart failed", error);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function setQuantityAction(
  lineId: string,
  quantity: number,
): Promise<CartActionResult> {
  try {
    const cart = await setLineQuantity(lineId, quantity);
    revalidatePath("/cart");
    return { ok: true, itemCount: cart?.itemCount ?? 0 };
  } catch (error) {
    console.error("setQuantity failed", error);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function removeLineAction(lineId: string): Promise<CartActionResult> {
  try {
    const cart = await removeLine(lineId);
    revalidatePath("/cart");
    return { ok: true, itemCount: cart?.itemCount ?? 0 };
  } catch (error) {
    console.error("removeLine failed", error);
    return { ok: false, error: GENERIC_ERROR };
  }
}
