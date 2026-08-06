import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { ExecArgs } from "@medusajs/framework/types";
import { call, SpeedyApiError } from "../modules/speedy/client";
import { findOffices, findSites } from "../modules/speedy/offices";
import { quote } from "../modules/speedy/shipment";

/**
 * Everything about a Speedy parcel except creating one.
 *
 * Speedy have no test environment — they say so plainly — so the whole payload
 * is put through `/calculate`, which validates the office, the address and the
 * cash-on-delivery exactly as `/shipment` would, and registers nothing.
 *
 *   medusa exec ./src/scripts/check-speedy-shipment.ts
 *
 * Nothing here is billable. The one write it attempts is expected to be
 * refused, and that refusal is the check.
 */
export default async function checkSpeedyShipment({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  let pass = 0;
  let fail = 0;
  const check = (name: string, ok: boolean, extra = "") => {
    if (ok) { pass += 1; logger.info(`PASS  ${name}`); }
    else { fail += 1; logger.error(`FAIL  ${name}${extra ? `  <- ${extra}` : ""}`); }
  };

  /* A capital, a second city, a small town and a village — the four shapes of
     Bulgarian address, rather than four names picked at random. Varna is the
     shop's own city and therefore the case least likely to be wrong. */
  for (const city of ["София", "Пловдив", "Смолян", "Разлог"]) {
    try {
      const sites = await findSites(city);
      /* Case-folded: Speedy answer in capitals, and an exact match reads as
         "no such town". */
      const site =
        sites.find((s) => s.name.toLowerCase() === city.toLowerCase() && s.type.startsWith("гр")) ??
        sites.find((s) => s.name.toLowerCase() === city.toLowerCase());

      if (!site) {
        check(`${city}: settlement found`, false, `${sites.length} came back`);
        continue;
      }

      const offices = await findOffices(site.id);
      if (offices.length === 0) {
        check(`${city}: has offices`, false, "none returned");
        continue;
      }

      const toOffice = await quote({
        officeId: offices[0]!.id,
        receiver: { name: "Иван Петров", phone: "0888123456" },
        codAmount: 40.55,
        reference: "тест",
      });

      logger.info(
        `  ${city.padEnd(10)} → ${offices.length} офиса · до офис ${toOffice.total.toFixed(2)} ${toOffice.currency}`,
      );
      check(`${city}: an office parcel is accepted`, toOffice.total > 0, String(toOffice.total));
    } catch (error) {
      check(`${city}: an office parcel is accepted`, false, (error as Error).message);
    }
  }

  /* And one to a door rather than a counter. Econt refused exactly this case
     for want of a delivery day, and only creating one found it — so it is
     worth asking Speedy the same question. */
  try {
    const sites = await findSites("София");
    const sofia = sites.find((s) => s.name.toLowerCase() === "софия" && s.type.startsWith("гр"));
    const streets = await call<{ streets?: { id: number; name: string }[] }>("/location/street", {
      siteId: sofia!.id,
      name: "Витоша",
    });
    const street = streets.streets?.[0];

    const toDoor = await quote({
      address: { siteId: sofia!.id, streetId: street!.id, streetNo: "1" },
      receiver: { name: "Иван Петров", phone: "0888123456" },
      codAmount: 40.55,
      reference: "тест",
    });

    logger.info(`  до адрес в София → ${toDoor.total.toFixed(2)} ${toDoor.currency} (${street?.name})`);
    check("София: a street address is accepted", toDoor.total > 0, String(toDoor.total));
  } catch (error) {
    check("София: a street address is accepted", false, (error as Error).message);
  }

  /* The guard, not the credentials, is what stands between a typo and a real
     parcel. Speedy have no demo, so this is the only thing between them. */
  try {
    await call("/shipment", {});
    check("creating a shipment is refused without allowWrite", false, "it went through");
  } catch (error) {
    check(
      "creating a shipment is refused without allowWrite",
      error instanceof SpeedyApiError && error.message.includes("allowWrite"),
      (error as Error).message,
    );
  }

  logger.info(`\n${pass} passed, ${fail} failed — нищо не е създадено`);
}
