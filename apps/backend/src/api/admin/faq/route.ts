import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { readFaq, writeFaq } from "../../../modules/faq/store";

/**
 * The shop's answers, read and written by the admin screen.
 *
 * The whole list travels in both directions. Anything the client removed is
 * gone because it is absent, which is the same thing the screen shows them —
 * no separate delete to get out of step with the list they are looking at.
 */

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ faq: await readFaq(req.scope) });
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const body = req.body as { faq?: unknown };

  if (!Array.isArray(body?.faq)) {
    res.status(400).json({ message: "Очаква се списък с въпроси." });
    return;
  }

  try {
    const saved = await writeFaq(req.scope, body.faq);
    logger.info(`faq saved: ${saved.length} entries`);
    res.json({ faq: saved });
  } catch (error) {
    logger.error(`faq save failed: ${error}`);
    res.status(500).json({ message: "Въпросите не бяха записани." });
  }
}
