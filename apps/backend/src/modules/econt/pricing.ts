import { call } from "./client";

/**
 * What Econt would charge for one delivery.
 *
 * NOT what the shopper pays. The shop charges a flat 2.55 € to an office and
 * 3.06 € to an address, by the client's decision, and absorbs the difference —
 * on the tariff measured in August 2026 that is about 4 € an order. This module
 * exists to quote, to sanity-check an invoice and to price a waybill, never to
 * set a price in checkout. Wiring it there would change a business decision,
 * not fix a bug.
 *
 * Priced through `createLabel` with `mode: "calculate"` — the same call that
 * creates a waybill. That is Econt's design and it is worth naming: the only
 * thing between a quote and a registered parcel is one string. The client
 * guards on that field, and this module never sends anything else.
 *
 * Euro throughout. Measured against their demo: send `cdCurrency: "EUR"` with
 * 40.55 and the cash-on-delivery is recorded as 40.55; send BGN and they
 * convert it, so the sum on the waybill stops matching the sum on the order.
 * The shop sells in euro, so euro is what goes on the parcel.
 */

/** Where the parcel starts. The shop's own counter, on every waybill. */
const SENDER = {
  name: "Red Point",
  phone: "0892475402",
  cityId: 7, // Варна
  street: "бул. Владислав Варненчик",
  num: "15",
};

/**
 * One kilo unless told otherwise.
 *
 * The catalogue carries no weights — the client chose flat shipping precisely
 * so it would not have to. Econt still want a number, and a shirt, a pair of
 * jeans and three t-shirts all sit inside the first weight band, so a declared
 * default is honest rather than a guess that drifts.
 */
const DEFAULT_WEIGHT_KG = 1;

export interface QuoteRequest {
  /** Econt office code, from the office list. */
  officeCode?: string;
  /** Or a street address, when delivering to the door. */
  address?: { cityId: number; street: string; num: string };
  /** Cash on delivery, in euro. Omit for a prepaid order. */
  codAmount?: number;
  weightKg?: number;
}

export interface Quote {
  /** What the delivery costs, in euro. */
  total: number;
  currency: string;
  /** Each line Econt charge for, so a surprise can be read rather than guessed. */
  lines: { description: string; amount: number }[];
}

interface LabelResponse {
  label?: {
    totalPrice?: number;
    currency?: string;
    services?: { description?: string; price?: number }[];
  };
}

export async function quote(request: QuoteRequest): Promise<Quote> {
  if (!request.officeCode && !request.address) {
    throw new Error("a quote needs either an office code or an address");
  }

  const data = await call<LabelResponse>("Shipments/LabelService.createLabel.json", {
    label: {
      senderClient: { name: SENDER.name, phones: [SENDER.phone] },
      senderAddress: {
        city: { id: SENDER.cityId },
        street: SENDER.street,
        num: SENDER.num,
      },
      /* A quote does not need a real recipient, and inventing one would put a
         fictional name into Econt's logs. The name is what the field demands
         and nothing more; the address is what actually changes the price. */
      receiverClient: { name: "—", phones: ["0000000000"] },
      ...(request.officeCode
        ? { receiverOfficeCode: request.officeCode }
        : {
            receiverAddress: {
              city: { id: request.address!.cityId },
              street: request.address!.street,
              num: request.address!.num,
            },
          }),
      packCount: 1,
      shipmentType: "PACK",
      weight: request.weightKg ?? DEFAULT_WEIGHT_KG,
      shipmentDescription: "дрехи",
      ...(request.codAmount
        ? { services: { cdAmount: request.codAmount, cdType: "get", cdCurrency: "EUR" } }
        : {}),
    },
    mode: "calculate",
  });

  return {
    total: data.label?.totalPrice ?? 0,
    currency: data.label?.currency ?? "EUR",
    lines: (data.label?.services ?? []).map((service) => ({
      description: service.description ?? "",
      amount: service.price ?? 0,
    })),
  };
}
