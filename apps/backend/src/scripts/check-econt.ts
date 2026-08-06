import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { ExecArgs } from "@medusajs/framework/types";
import { call, EcontApiError, isSandbox } from "../modules/econt/client";
import { listOffices, officesInCity } from "../modules/econt/offices";
import { quote } from "../modules/econt/pricing";

/**
 * Proves the Econt connection without creating anything.
 *
 *   medusa exec ./src/scripts/check-econt.ts
 *
 * Read-only by construction: the one write it attempts is expected to be
 * refused, and that refusal is the check. A courier module that can be tested
 * only by summoning a courier cannot be tested.
 */
export default async function checkEcont({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

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

  logger.info(isSandbox() ? "system: demo.econt.com" : "system: ee.econt.com (LIVE)");

  let offices: Awaited<ReturnType<typeof listOffices>> = [];
  try {
    offices = await listOffices();
    check("the office list answers", offices.length > 0, String(offices.length));
  } catch (error) {
    check("the office list answers", false, (error as Error).message);
    logger.info(`\n${pass} passed, ${fail} failed`);
    return;
  }

  const varna = await officesInCity("Варна");
  check("Varna has offices", varna.length > 0, String(varna.length));

  const sample = varna[0];
  check("an office carries a code", Boolean(sample?.code), sample?.code);
  check("an office carries an address", Boolean(sample?.address), sample?.address);
  check(
    "business hours are readable",
    offices.some((office) => /^\d{2}:\d{2} - \d{2}:\d{2}$/.test(office.hours ?? "")),
    offices.find((office) => office.hours)?.hours ?? "none",
  );

  /* Nothing may be created by accident. The guard, not the credentials, is what
     stands between a typo and a courier at somebody's door. */
  try {
    await call("Shipments/LabelService.createLabel.json", {});
    check("creating a label is refused without allowWrite", false, "it went through");
  } catch (error) {
    check(
      "creating a label is refused without allowWrite",
      error instanceof EcontApiError && error.message.includes("allowWrite"),
      (error as Error).message,
    );
  }

  /* Pricing. A quote goes through the same method that creates a waybill, so
     these also prove the mode guard lets a read through while the check above
     proves it stops a write. */
  try {
    const toOffice = await quote({ officeCode: sample!.code, codAmount: 40.55 });
    check("an office quote comes back", toOffice.total > 0, String(toOffice.total));
    check("it is priced in euro", toOffice.currency === "EUR", toOffice.currency);
    check("the charges are itemised", toOffice.lines.length > 0, String(toOffice.lines.length));
    logger.info(
      `  до офис ${sample!.code}: ${toOffice.total.toFixed(2)} € — ` +
        toOffice.lines.map((line) => `${line.description} ${line.amount.toFixed(2)}`).join(" + "),
    );

    const toDoor = await quote({
      address: { cityId: 7, street: "ул. Дунав", num: "5" },
      codAmount: 40.55,
    });
    check("an address quote comes back", toDoor.total > 0, String(toDoor.total));
    check("delivering to the door costs more", toDoor.total >= toOffice.total,
      `${toDoor.total} vs ${toOffice.total}`);
    logger.info(`  до адрес: ${toDoor.total.toFixed(2)} €`);
  } catch (error) {
    check("pricing works", false, (error as Error).message);
  }

  /* Their errors nest: a rejected label answers `message: " "` at the top with
     the reason three levels down. A blank message is worse than none — it reads
     as a call that succeeded and returned nothing. */
  try {
    await quote({ officeCode: "не-съществува" });
    check("a bad office is reported", false, "it went through");
  } catch (error) {
    const message = (error as Error).message;
    check("a bad office is reported with a real message", message.trim().length > 30, message);
  }

  for (const office of varna.slice(0, 5)) {
    logger.info(`  [${office.code}] ${office.name} · ${office.address}${office.hours ? ` · ${office.hours}` : ""}`);
  }

  logger.info(`\n${pass} passed, ${fail} failed`);
}
