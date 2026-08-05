import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { capturePaymentWorkflow } from "@medusajs/medusa/core-flows";
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

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({
    entity: "order",
    filters: { display_id: Number(body.OrderID) },
    fields: [
      "id",
      "display_id",
      "total",
      "currency_code",
      "payment_collections.id",
      "payment_collections.status",
      "payment_collections.payments.id",
      "payment_collections.payments.captured_at",
    ],
  });

  const order = data[0];
  if (!order) {
    /* A 200 anyway. myPOS retry anything else, and retrying will not conjure
       an order that does not exist — it would just repeat forever. The warning
       is the thing a human needs to see. */
    logger.error(`myPOS notify: no order with display_id ${body.OrderID}; payment NOT recorded`);
    res.status(200).type("text/plain").send("OK");
    return;
  }

  /* The amount myPOS charged must equal what the order says. If it does not,
     something is wrong that no amount of retrying fixes, and quietly marking
     the order paid would hide it. */
  const charged = Number(body.Amount);
  if (Number.isFinite(charged) && Math.abs(charged - Number(order.total)) > 0.01) {
    logger.error(
      `myPOS notify: order ${body.OrderID} totals ${order.total} but ${charged} was charged; ` +
        "payment NOT recorded, needs a human",
    );
    res.status(200).type("text/plain").send("OK");
    return;
  }

  const payment = (order.payment_collections ?? [])
    .flatMap((collection: { payments?: { id: string; captured_at?: string | null }[] }) =>
      collection.payments ?? [],
    )
    .find((entry: { captured_at?: string | null }) => !entry.captured_at);

  if (!payment) {
    // Already captured: myPOS retry until they get an OK, so this is normal.
    logger.info(`myPOS notify: order ${body.OrderID} already captured, nothing to do`);
    res.status(200).type("text/plain").send("OK");
    return;
  }

  try {
    await capturePaymentWorkflow(req.scope).run({
      input: { payment_id: payment.id },
    });
    logger.info(`myPOS notify: captured payment for order ${body.OrderID}`);
  } catch (error) {
    /* Not 200. This is the one failure worth a retry: the signature was good,
       the order is right, and the capture itself went wrong. */
    logger.error(`myPOS notify: capture failed for order ${body.OrderID}: ${error}`);
    res.status(500).type("text/plain").send("CAPTURE FAILED");
    return;
  }

  res.status(200).type("text/plain").send("OK");
}
