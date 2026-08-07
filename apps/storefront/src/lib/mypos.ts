/**
 * Asks the backend for a signed myPOS purchase form.
 *
 * Server-side only. The signing needs the shop's private key, which lives with
 * Medusa, so the storefront's job is to relay the order id and render whatever
 * comes back. Nothing here can forge a payment request.
 */

/* Runtime name first — see the note in lib/medusa.ts. */
const BACKEND_URL =
  process.env.MEDUSA_BACKEND_URL ??
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ??
  "http://localhost:9000";

export interface MyposPurchase {
  url: string;
  /** Rendered as hidden inputs in this exact order — it is part of the signature. */
  fields: Record<string, string>;
}

export async function buildMyposPurchase(orderId: string): Promise<MyposPurchase | null> {
  try {
    const response = await fetch(`${BACKEND_URL}/hooks/mypos/purchase`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ order_id: orderId }),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(
        `myPOS purchase unavailable for order ${orderId}: ${response.status} ${await response
          .text()
          .catch(() => "")}`,
      );
      return null;
    }

    return (await response.json()) as MyposPurchase;
  } catch (error) {
    console.error(`myPOS purchase request failed for order ${orderId}`, error);
    return null;
  }
}
