import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { findOffices, findSites } from "../../../../modules/speedy/offices";

/**
 * Speedy's offices in one town, for the picker in checkout.
 *
 * Two calls where Econt need one: Speedy address offices by settlement id, so a
 * typed town name has to be resolved first. That is their model rather than an
 * inefficiency — Bulgaria has several Варна-shaped names and an id says which.
 *
 * Read-only. Nothing reachable from a shopper's browser can create a shipment.
 */

const CACHE_MS = 60 * 60 * 1000;

/**
 * The shape the picker consumes — the same one Econt's route answers with.
 *
 * Deliberately not Speedy's own `SpeedyOffice`. The point of this route is that
 * both couriers come out identical by the time the storefront sees them, so
 * that is what gets cached and what the type says.
 */
interface PickerOffice {
  code: string;
  name: string;
  city: string;
  postCode: string;
  address: string;
  hours: string | null;
  isMachine: boolean;
}

const cache = new Map<string, { at: number; offices: PickerOffice[] }>();

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const city = typeof req.query.city === "string" ? req.query.city.trim() : "";

  if (city.length < 2) {
    res.json({ offices: [] });
    return;
  }

  const key = city.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    res.json({ offices: hit.offices });
    return;
  }

  try {
    const sites = await findSites(city);

    /* Speedy answer in capitals — ВАРНА, not Варна — so this folds case. An
       exact comparison finds nothing and reads as "no such town".
       Towns before villages: somebody typing a name that is both means the
       town far more often than not. */
    const wanted = key;
    const site =
      sites.find((entry) => entry.name.toLowerCase() === wanted && entry.type.startsWith("гр")) ??
      sites.find((entry) => entry.name.toLowerCase() === wanted) ??
      sites[0];

    if (!site) {
      res.json({ offices: [] });
      return;
    }

    const offices = (await findOffices(site.id)).map((office) => ({
      code: String(office.id),
      name: office.name,
      city: site.name,
      postCode: site.postCode,
      address: office.address,
      hours: office.workingTime ?? null,
      isMachine: /автомат|apt|locker/i.test(office.name),
    }));

    cache.set(key, { at: Date.now(), offices });
    res.json({ offices });
  } catch (error) {
    /* A courier being unreachable must not take checkout down with it. The
       shop's shipping prices are flat, so an order can still be placed and
       paid; what is lost is picking an office from a live list. */
    logger.error(`speedy offices failed: ${error}`);
    res.status(503).json({
      offices: [],
      message: "Списъкът с офиси не се зареди. Опитайте пак или изберете доставка до адрес.",
    });
  }
}
