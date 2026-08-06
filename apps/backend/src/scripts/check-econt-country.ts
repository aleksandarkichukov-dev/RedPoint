import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { ExecArgs } from "@medusajs/framework/types";
import { isSandbox } from "../modules/econt/client";
import { officesInCity } from "../modules/econt/offices";
import { cancelWaybill, createWaybill } from "../modules/econt/waybill";

/**
 * A parcel to every kind of place in the country, not just the shop's own city.
 *
 * Varna is where the shop is, so it is where every earlier test went — and a
 * courier module that has only ever addressed its own town has proved the one
 * case least likely to be wrong.
 *
 *   medusa exec ./src/scripts/check-econt-country.ts
 *
 * Demo only. Every waybill here is created and cancelled.
 */
export default async function checkEcontCountry({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  if (!isSandbox()) {
    logger.error("refusing to run against the live system — this creates real parcels.");
    return;
  }

  let pass = 0;
  let fail = 0;
  const check = (name: string, ok: boolean, extra = "") => {
    if (ok) { pass += 1; logger.info(`PASS  ${name}`); }
    else { fail += 1; logger.error(`FAIL  ${name}${extra ? `  <- ${extra}` : ""}`); }
  };

  /* A capital, a second city, a small town, and a village — the four shapes of
     Bulgarian address, rather than four names picked at random. */
  const cities = ["София", "Пловдив", "Смолян", "Разлог"];

  for (const city of cities) {
    const offices = await officesInCity(city);
    if (offices.length === 0) {
      check(`${city}: has offices`, false, "none returned");
      continue;
    }

    try {
      const waybill = await createWaybill({
        receiver: { name: "Иван Петров", phone: "0888123456" },
        officeCode: offices[0]!.code,
        codAmount: 40.55,
        reference: "тест",
      });
      logger.info(
        `  ${city.padEnd(10)} → ${offices.length} офиса · ${waybill.number} · ${waybill.total.toFixed(2)} ${waybill.currency}`,
      );
      check(`${city}: waybill to an office`, waybill.total > 0, String(waybill.total));
      await cancelWaybill(waybill.number);
    } catch (error) {
      check(`${city}: waybill to an office`, false, (error as Error).message);
    }
  }

  /* And one to a door rather than a counter, in a city that is not the shop's. */
  try {
    const toDoor = await createWaybill({
      receiver: { name: "Иван Петров", phone: "0888123456" },
      address: { cityName: "София", street: "бул. Витоша", num: "1" },
      codAmount: 40.55,
      reference: "тест",
    });
    logger.info(`  до адрес в София → ${toDoor.number} · ${toDoor.total.toFixed(2)} ${toDoor.currency}`);
    check("София: waybill to a street address", toDoor.total > 0, String(toDoor.total));
    await cancelWaybill(toDoor.number);
  } catch (error) {
    check("София: waybill to a street address", false, (error as Error).message);
  }

  logger.info(`\n${pass} passed, ${fail} failed`);
}
