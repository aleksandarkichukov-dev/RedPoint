import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { readFaq } from "../../../modules/faq/store";

/**
 * The same answers, for the shop front.
 *
 * Under `/store`, so it goes through the publishable-key middleware like every
 * other read the storefront makes. Read-only: nothing about a shopper's session
 * should be able to change what the shop says.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ faq: await readFaq(req.scope) });
}
