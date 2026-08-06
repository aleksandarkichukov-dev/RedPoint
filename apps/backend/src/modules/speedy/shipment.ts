import { call, getSpeedyCredentials } from "./client";
import { findSites } from "./offices";

/**
 * Pricing a Speedy delivery, and creating one.
 *
 * The two live together because they take the same payload — which is the
 * point. `quote` sends it to `/calculate`, which validates everything and
 * creates nothing; `create` sends the same shape to `/shipment`, which
 * registers a real, billable parcel.
 *
 * Speedy have no test environment and say so plainly: they do not make test
 * users for platforms with existing plugins. So `/calculate` is the only
 * rehearsal there is, and it is a good one — it rejects a bad office, a bad
 * address and a forbidden cash-on-delivery exactly as the real call would.
 *
 * Everything here that writes passes `allowWrite`, and nothing in the storefront
 * does. At Econt a mistake costs a cancelled demo label; here it costs a parcel.
 */

/** "СТАНДАРТ 24 ЧАСА" — the service every ordinary parcel goes by. */
const SERVICE_STANDARD_24H = 505;

export interface SpeedyRequest {
  /** A Speedy office id, from the office list. */
  officeId?: number;
  /** Or an address: the settlement, the street and the number. */
  address?: { siteId: number; streetId: number; streetNo: string };
  receiver: { name: string; phone: string };
  /** Cash on delivery in euro. Omit when the order is already paid. */
  codAmount?: number;
  weightKg?: number;
  /** What goes on the parcel, e.g. the order number. */
  reference?: string;
}

export interface SpeedyQuote {
  total: number;
  currency: string;
}

export interface SpeedyShipment {
  /** The number a shopper tracks the parcel with. */
  number: string;
  total: number;
  currency: string;
}

function payload(request: SpeedyRequest) {
  const { clientNumber } = getSpeedyCredentials();

  if (!request.officeId && !request.address) {
    throw new Error("a Speedy shipment needs either an office or an address");
  }

  return {
    sender: { clientId: Number(clientNumber) },
    recipient: {
      privatePerson: true,
      clientName: request.receiver.name,
      contactName: request.receiver.name,
      phone1: { number: request.receiver.phone },
      ...(request.officeId
        ? { pickupOfficeId: request.officeId }
        : {
            addressLocation: { siteId: request.address!.siteId },
            address: {
              siteId: request.address!.siteId,
              streetId: request.address!.streetId,
              streetNo: request.address!.streetNo,
            },
          }),
    },
    service: {
      serviceIds: [SERVICE_STANDARD_24H],
      /* Speedy refuse a pickup date that has already passed, and an order
         placed after the last collection of the day is exactly when a shop
         prints labels. This moves it to the next working day rather than
         failing. */
      autoAdjustPickupDate: true,
      ...(request.codAmount
        ? {
            additionalServices: {
              cod: {
                amount: request.codAmount,
                processingType: "CASH",
                currencyCode: "EUR",
              },
            },
          }
        : {}),
    },
    content: {
      parcelsCount: 1,
      totalWeight: request.weightKg ?? 1,
      contents: "дрехи",
      package: "BOX",
      ...(request.reference ? { ref1: request.reference } : {}),
    },
    payment: { courierServicePayer: "SENDER", declaredValuePayer: "SENDER" },
  };
}

interface CalculateResponse {
  calculations?: {
    serviceId?: number;
    price?: { total?: number; currency?: string };
    error?: { message?: string };
  }[];
}

/**
 * What Speedy would charge, and whether they would accept this parcel at all.
 *
 * Creates nothing. This is the only rehearsal available for Speedy, so it is
 * what the checks use in place of the demo Econt has.
 */
export async function quote(request: SpeedyRequest): Promise<SpeedyQuote> {
  const data = await call<CalculateResponse>("/calculate", payload(request));
  const first = data.calculations?.[0];

  /* Speedy report a rejected calculation inside the calculation rather than as
     a request error, so a caller reading only the HTTP result sees success and
     a price of undefined. */
  if (first?.error) throw new Error(first.error.message ?? "Speedy refused the calculation");
  if (!first?.price?.total) throw new Error("Speedy returned no price");

  return { total: first.price.total, currency: first.price.currency ?? "EUR" };
}

interface ShipmentResponse {
  id?: string;
  price?: { total?: number; currency?: string };
}

/**
 * Registers a real parcel. Billable, and not reversible by pressing again.
 *
 * Speedy have no sandbox, so this call has never been rehearsed anywhere — the
 * first one will be for a real order. `quote` above takes the same payload and
 * validates it, which is as close as this gets to a dry run.
 */
export async function createShipment(request: SpeedyRequest): Promise<SpeedyShipment> {
  const data = await call<ShipmentResponse>("/shipment", payload(request), { allowWrite: true });

  if (!data.id) throw new Error("Speedy accepted the shipment but returned no number");

  return {
    number: data.id,
    total: data.price?.total ?? 0,
    currency: data.price?.currency ?? "EUR",
  };
}

/**
 * Turns a typed address into the ids Speedy insist on.
 *
 * Econt take a street by name; Speedy want a settlement id and a street id, and
 * a shopper types neither. So the town and the street are looked up from what
 * they wrote.
 *
 * It refuses rather than guessing. A street that cannot be resolved is a parcel
 * that would go to the wrong door or to none at all, and the shop can issue
 * that one by hand knowing exactly why.
 */
export async function resolveAddress(
  city: string,
  street: string,
): Promise<{ siteId: number; streetId: number; streetNo: string }> {
  const sites = await findSites(city);
  const wanted = city.trim().toLowerCase();

  /* Case-folded, towns before villages: Speedy answer in capitals, and a name
     that is both is far more often the town. */
  const site =
    sites.find((s) => s.name.toLowerCase() === wanted && s.type.startsWith("гр")) ??
    sites.find((s) => s.name.toLowerCase() === wanted);

  if (!site) throw new Error(`Спиди не разпознават населено място „${city}".`);

  /* The house number is whatever trails the street name — "ул. Дунав 5" is one
     field to a shopper and two to Speedy. */
  const match = street.trim().match(/^(.*?)[\s,]+(\d+[a-zA-Zа-яА-Я]?)\s*$/);
  const streetName = (match?.[1] ?? street).replace(/^(ул\.|бул\.|жк|ж\.к\.)\s*/i, "").trim();
  const streetNo = match?.[2] ?? "";

  const found = await call<{ streets?: { id: number; name: string }[] }>("/location/street", {
    siteId: site.id,
    name: streetName,
  });

  const first = found.streets?.[0];
  if (!first) {
    throw new Error(
      `Спиди не разпознават улица „${streetName}" в ${site.name}. ` +
        "Издайте товарителницата от панела на Спиди.",
    );
  }

  return { siteId: site.id, streetId: first.id, streetNo: streetNo || "1" };
}

/**
 * Cancels a shipment Speedy have not collected yet.
 *
 * A failure here is ordinary rather than exceptional: it usually means the
 * parcel is already with a courier, and the answer to the shop is to call them.
 */
export async function cancelShipment(id: string, comment = "отказана поръчка"): Promise<void> {
  await call("/shipment/cancel", { shipmentId: id, comment }, { allowWrite: true });
}
