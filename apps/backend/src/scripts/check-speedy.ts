import type { ExecArgs } from "@medusajs/framework/types";
import { call, getSpeedyCredentials } from "../modules/speedy/client";
import { findOffices, findSites } from "../modules/speedy/offices";

/**
 * Proves the Speedy credentials work, using read-only calls only.
 *
 *   pnpm --filter @redpoint/backend exec medusa exec ./src/scripts/check-speedy.ts
 *
 * Nothing here creates a shipment. Looking up settlements and offices is free
 * and leaves no trace at Speedy, so this is safe to run against production
 * credentials — which matters, because it is not yet established whether these
 * are test ones.
 */
export default async function checkSpeedy({ container }: ExecArgs) {
  const logger = container.resolve("logger");

  const { userName, clientNumber } = getSpeedyCredentials();
  logger.info(`user ${userName}, client number ${clientNumber}`);

  let sites;
  try {
    sites = await findSites("Варна");
  } catch (error) {
    /* Speedy answer "Достъпът е отказан" with code 1 both for a wrong password
       and for an account that simply has no Web API access — the portal login
       and the API login are not the same thing, and API access is granted
       separately. The message alone sends you checking the password, which is
       usually not the problem. */
    if (error instanceof Error && /отказан|denied/i.test(error.message)) {
      logger.error(
        `Speedy refused user ${userName}. Two things to check with them, in this order:\n` +
          "  1. Is Web API access enabled for this user? Portal credentials are not API credentials.\n" +
          "  2. Is the password the API one rather than the website one?\n" +
          `Original: ${error.message}`,
      );
      return;
    }
    throw error;
  }
  logger.info(`"Варна" matched ${sites.length} settlements`);
  for (const site of sites.slice(0, 5)) {
    logger.info(`  ${site.type} ${site.name}, ${site.postCode} (${site.region ?? "-"}) id ${site.id}`);
  }

  const varna = sites.find((site) => site.name === "Варна" && site.type.startsWith("гр"));
  if (!varna) {
    logger.warn("no town called Варна came back; the office lookup is skipped");
    return;
  }

  const offices = await findOffices(varna.id);
  logger.info(`Варна has ${offices.length} Speedy offices`);
  for (const office of offices.slice(0, 5)) {
    logger.info(`  #${office.id} ${office.name} — ${office.address}`);
  }

  /* The write guard is part of the contract, so it gets tested like anything
     else. This must throw rather than reach Speedy. */
  let guarded = false;
  try {
    await call("/shipment", {});
  } catch (error) {
    guarded = error instanceof Error && error.message.includes("allowWrite");
  }
  logger.info(`${guarded ? "PASS" : "FAIL"}  creating a shipment is refused without allowWrite`);

  if (!guarded) throw new Error("the write guard did not hold");
}
