import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { listOffices, officesInCity } from "../../../../modules/econt/offices";

/**
 * Econt's offices, for the office picker in checkout.
 *
 * Under `/store`, so it passes the publishable-key middleware like every other
 * read the shop front makes. Read-only — nothing reachable from a shopper's
 * browser may create a shipment.
 *
 * Held in memory for an hour. Econt's list is 585 offices and changes about as
 * often as a new branch opens, while a checkout can ask for it several times
 * per shopper. Fetching it per keystroke would make their system the slow part
 * of our checkout.
 */

const CACHE_MS = 60 * 60 * 1000;

let cached: { at: number; offices: Awaited<ReturnType<typeof listOffices>> } | null = null;

async function all() {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.offices;

  const offices = await listOffices();
  cached = { at: Date.now(), offices };
  return offices;
}

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const city = typeof req.query.city === "string" ? req.query.city.trim() : "";

  try {
    const offices = await all();

    /* Matched on the city containing what was typed rather than equalling it,
       because a shopper writes `варна` and the list says `Варна`, and someone
       in `Горна Оряховица` should not have to spell all of it to see anything.
       An empty query returns everything, which the picker filters itself. */
    const wanted = city.toLowerCase();
    const matching = wanted
      ? offices.filter((office) => office.city.toLowerCase().includes(wanted))
      : offices;

    res.json({ offices: matching });
  } catch (error) {
    /* A courier being unreachable must not take checkout down with it. The
       shop has flat shipping prices, so an order can still be placed and paid;
       what is lost is picking an office from a live list. */
    logger.error(`econt offices failed: ${error}`);
    res.status(503).json({
      offices: [],
      message: "Списъкът с офиси не се зареди. Опитайте пак или изберете доставка до адрес.",
    });
  }
}
