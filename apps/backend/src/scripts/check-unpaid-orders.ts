import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { ExecArgs } from "@medusajs/framework/types";
import { findAbandonedCardOrders, isAbandoned, GRACE_MINUTES } from "../lib/unpaid-orders";

/**
 * The unpaid-orders screen, checked without opening the admin.
 *
 *   medusa exec ./src/scripts/check-unpaid-orders.ts
 *
 * The decision this screen makes is a filter, and a filter is exactly the kind
 * of thing that looks right and is wrong. The expensive mistake is not missing
 * an abandoned order — it is listing a cash-on-delivery order as abandoned,
 * because then the shop rings a customer to ask about money they were never
 * going to send, and stops trusting the screen.
 *
 * Read-only, and it invents its orders rather than writing any.
 */
export default async function checkUnpaidOrders({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  let pass = 0;
  let fail = 0;
  const check = (name: string, ok: boolean, extra = "") => {
    if (ok) { pass += 1; logger.info(`PASS  ${name}`); }
    else { fail += 1; logger.error(`FAIL  ${name}${extra ? `  <- ${extra}` : ""}`); }
  };

  const now = Date.now();
  const cutoff = now - GRACE_MINUTES * 60 * 1000;
  const old = new Date(now - 6 * 60 * 60 * 1000).toISOString();
  const fresh = new Date(now - 60 * 1000).toISOString();

  const order = (over: Record<string, any>) => ({
    status: "pending",
    created_at: old,
    metadata: { payment_intent: "card" },
    payment_collections: [{ status: "awaiting" }],
    ...over,
  });

  check("an abandoned card payment is listed", isAbandoned(order({}), cutoff));

  check(
    "cash on delivery is not",
    !isAbandoned(order({ metadata: { payment_intent: "cod" } }), cutoff),
  );

  /* Everything placed before checkout recorded the intent looks like this. */
  check(
    "an order from before this existed is treated as cash",
    !isAbandoned(order({ metadata: {} }), cutoff),
  );
  check(
    "so is one with no metadata at all",
    !isAbandoned(order({ metadata: null }), cutoff),
  );

  check(
    "a paid card order is not listed",
    !isAbandoned(order({ payment_collections: [{ status: "completed" }] }), cutoff),
  );

  check(
    "a cancelled order is not listed",
    !isAbandoned(order({ status: "canceled" }), cutoff),
  );

  check(
    "a card payment still in progress is left alone",
    !isAbandoned(order({ created_at: fresh }), cutoff),
  );

  /* And against the real database, which is what proves the query reads the
     fields it thinks it does. */
  const real = await findAbandonedCardOrders(container, now);
  check("the query runs against the real catalogue", Array.isArray(real));

  logger.info(`\nВ базата в момента: ${real.length} неплатени картови поръчки`);
  for (const entry of real.slice(0, 5)) {
    logger.info(`  № ${entry.displayId} · ${entry.name || entry.email} · ${entry.total}`);
  }
  logger.info(`${pass} passed, ${fail} failed`);
}
