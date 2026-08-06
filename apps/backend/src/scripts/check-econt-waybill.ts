import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { ExecArgs } from "@medusajs/framework/types";
import { isSandbox } from "../modules/econt/client";
import { officesInCity } from "../modules/econt/offices";
import { cancelWaybill, createWaybill } from "../modules/econt/waybill";

/**
 * Creates a real waybill and cancels it again.
 *
 * The one thing every other check deliberately avoids, and therefore the one
 * thing still unproven: that a parcel comes out addressed to the right office,
 * with the right cash-on-delivery amount, from the right sender.
 *
 *   medusa exec ./src/scripts/check-econt-waybill.ts
 *
 * It refuses to run outside the demo. On the shop's real account this would
 * register a parcel a courier comes to collect, and a check that can do that
 * by being run in the wrong terminal is not a check, it is a trap.
 */
export default async function checkEcontWaybill({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  if (!isSandbox()) {
    logger.error(
      "refusing to run against the live system — this creates a real parcel. " +
        "Set COURIERS_SANDBOX=true to run it.",
    );
    return;
  }

  let pass = 0;
  let fail = 0;
  const check = (name: string, ok: boolean, extra = "") => {
    if (ok) {
      pass += 1;
      logger.info(`PASS  ${name}`);
    } else {
      fail += 1;
      logger.error(`FAIL  ${name}${extra ? `  <- ${extra}` : ""}`);
    }
  };

  const [office] = await officesInCity("Варна");
  if (!office) {
    logger.error("no Varna offices to address a parcel to");
    return;
  }

  logger.info(`system: demo.econt.com — addressing to [${office.code}] ${office.name}`);

  let created: Awaited<ReturnType<typeof createWaybill>> | null = null;

  try {
    created = await createWaybill({
      receiver: { name: "Иван Петров", phone: "0888123456" },
      officeCode: office.code,
      codAmount: 40.55,
      reference: "4",
    });

    check("a waybill comes back", Boolean(created.number), created.number);
    check("with a shipment number to track", /\d{6,}/.test(created.number), created.number);
    check("priced", created.total > 0, String(created.total));
    check("in euro", created.currency === "EUR", created.currency);
    logger.info(
      `  товарителница ${created.number} · ${created.total.toFixed(2)} ${created.currency}` +
        (created.pdfUrl ? ` · ${created.pdfUrl}` : " · без PDF"),
    );
  } catch (error) {
    check("a waybill comes back", false, (error as Error).message);
  }

  /* Delivery to a street address as well: it takes a different branch, and a
     module that only ever addresses offices would fail on the first shopper
     who wants it brought to the door. */
  try {
    const toDoor = await createWaybill({
      receiver: { name: "Иван Петров", phone: "0888123456" },
      address: { cityName: "Варна", street: "ул. Дунав", num: "5" },
      codAmount: 40.55,
      reference: "4",
    });
    check("an address waybill comes back", Boolean(toDoor.number), toDoor.number);
    logger.info(
      `  до адрес: ${toDoor.number} · ${toDoor.total.toFixed(2)} ${toDoor.currency}`,
    );
    await cancelWaybill(toDoor.number);
  } catch (error) {
    check("an address waybill comes back", false, (error as Error).message);
  }

  /* Cancelled whether or not the checks passed. A test that leaves parcels
     behind in the demo teaches the shop that leftovers are normal. */
  if (created?.number) {
    try {
      await cancelWaybill(created.number);
      check("and can be cancelled again", true);
    } catch (error) {
      check("and can be cancelled again", false, (error as Error).message);
      logger.error(`  товарителница ${created.number} остана — отменете я ръчно`);
    }
  }

  logger.info(`\n${pass} passed, ${fail} failed`);
}
