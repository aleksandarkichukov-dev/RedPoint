import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { getMyposConfig } from "../../../../modules/mypos/config";
import { verify, type MyposParams } from "../../../../modules/mypos/signature";

/**
 * The myPOS server-to-server payment notification.
 *
 * This endpoint, not the shopper's browser, is what marks an order paid. myPOS
 * say it outright: never authorise from the redirect back to URL_OK. A browser
 * can be closed before it arrives, and anyone can visit that URL themselves.
 *
 * It lives under /hooks and NOT under /store, which was the first place it went.
 * Medusa guards every /store route with middleware demanding an
 * x-publishable-api-key header, and myPOS have no such key to send — every
 * genuine callback came back 400 before a line of this file ran. The failure is
 * invisible from the shop's side: orders simply never get marked paid.
 *
 * So this route is public and unauthenticated by necessity, and the ONLY thing
 * standing between it and a forged "paid" message is the signature check below.
 * Nothing here may run before it passes.
 *
 * myPOS expect exactly `OK` as plain text on 200. Anything else and they retry,
 * which is the behaviour we want on a genuine failure.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);

  let config;
  try {
    config = getMyposConfig();
  } catch (error) {
    logger.error(`myPOS notify received but the integration is not configured: ${error}`);
    res.status(500).send("NOT CONFIGURED");
    return;
  }

  const body = (req.body ?? {}) as Record<string, string>;
  const { Signature, ...params } = body;

  if (!verify(params as MyposParams, Signature, config.certificate)) {
    /* Deliberately terse to the caller and loud in the log. A forged callback
       gets told nothing it can learn from; we get a line naming the order. */
    logger.warn(
      `myPOS notify REJECTED: bad or missing signature (OrderID ${body.OrderID ?? "unknown"})`,
    );
    res.status(400).send("INVALID SIGNATURE");
    return;
  }

  if (body.SID !== config.sid) {
    logger.warn(`myPOS notify REJECTED: signed correctly but for SID ${body.SID}, not ours`);
    res.status(400).send("WRONG STORE");
    return;
  }

  logger.info(
    `myPOS notify accepted for order ${body.OrderID}: ${body.Amount} ${body.Currency}, ` +
      `transaction ${body.IPC_Trnref}`,
  );

  /* Capturing the payment against the Medusa order lands with the payment
     provider module. Until then the signature gate, the store check and the
     acknowledgement are real and tested, and the log records every genuine
     notification — so nothing is silently lost while that is built. */

  res.status(200).type("text/plain").send("OK");
}
