import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { findAbandonedCardOrders, GRACE_MINUTES } from "../../../../lib/unpaid-orders";

/**
 * Card orders that were never paid.
 *
 * A shopper who reaches myPOS and closes the tab leaves an order behind:
 * complete, correct, and waiting for money that will not arrive. It sits in the
 * order list looking exactly like every other order, which is how it stays
 * there — nobody scans a list for the absence of a payment.
 *
 * Reads only. Nothing here cancels anything, and that is deliberate rather than
 * unfinished: how long to wait before writing an order off is the shop's call,
 * and the order most likely to be swept away by a tired hand at closing time is
 * the one where the card failed twice and the customer then rang the shop.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);

  try {
    const orders = await findAbandonedCardOrders(req.scope);
    res.json({ orders, graceMinutes: GRACE_MINUTES });
  } catch (error) {
    logger.error(`unpaid orders lookup failed: ${error}`);
    res.status(500).json({ message: "Списъкът не можа да бъде зареден." });
  }
}
