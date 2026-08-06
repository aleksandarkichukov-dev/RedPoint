import { call } from "./client";
import { cityId } from "./offices";

/**
 * Creating and cancelling a waybill.
 *
 * This is the only file in the module that changes anything at Econt. Every
 * call here passes `allowWrite`, which is the point: the guard in the client
 * means a write cannot happen anywhere else by accident, and the places that
 * do write are the ones that said so out loud.
 *
 * A created waybill is a parcel a courier will come and collect. In the demo
 * that is free and reversible; in production it is neither.
 */

/** Where every parcel starts. The same sender the quotes are priced from. */
const SENDER = {
  name: "Red Point",
  phone: "0892475402",
  city: "Варна",
  street: "бул. Владислав Варненчик",
  num: "15",
};

export interface WaybillRequest {
  receiver: { name: string; phone: string };
  /** An office code, or a street address — one or the other. */
  officeCode?: string;
  address?: { cityName: string; street: string; num: string };
  /** Cash on delivery in euro. Omit when the order is already paid. */
  codAmount?: number;
  weightKg?: number;
  /** What the shop wants written on the parcel, e.g. the order number. */
  reference?: string;
}

export interface Waybill {
  /** The number a shopper can track the parcel with. */
  number: string;
  total: number;
  currency: string;
  /** Econt's own printable label, when they return one. */
  pdfUrl: string | null;
}

interface LabelResponse {
  label?: {
    shipmentNumber?: string;
    totalPrice?: number;
    currency?: string;
    pdfURL?: string;
  };
}

export async function createWaybill(request: WaybillRequest): Promise<Waybill> {
  if (!request.officeCode && !request.address) {
    throw new Error("a waybill needs either an office code or an address");
  }

  /* Resolved rather than written down: city ids differ between the demo and
     production, so a constant would pass every test and fail on the first
     real parcel. */
  const senderCityId = await cityId(SENDER.city);

  const data = await call<LabelResponse>(
    "Shipments/LabelService.createLabel.json",
    {
      label: {
        senderClient: { name: SENDER.name, phones: [SENDER.phone] },
        senderAddress: {
          city: { id: senderCityId },
          street: SENDER.street,
          num: SENDER.num,
        },
        receiverClient: { name: request.receiver.name, phones: [request.receiver.phone] },
        ...(request.officeCode
          ? { receiverOfficeCode: request.officeCode }
          : {
              receiverAddress: {
                city: { id: await cityId(request.address!.cityName) },
                street: request.address!.street,
                num: request.address!.num,
              },
            }),
        packCount: 1,
        shipmentType: "PACK",
        weight: request.weightKg ?? 1,
        /* Which days the parcel may be delivered on. Econt default it for a
           parcel that stays in the sender's own city and demand it for every
           other, so this was invisible until a waybill was addressed outside
           Varna — and their message, "Моля, изберете ден за доставка", names
           no field. Found by trying candidates until one stopped failing.

           `workday` rather than a weekend: a courier calling on a Saturday
           reaches an address nobody is at, and the shop does not pack on
           Sundays. */
        holidayDeliveryDay: "workday",
        shipmentDescription: request.reference
          ? `дрехи, поръчка ${request.reference}`
          : "дрехи",
        ...(request.codAmount
          ? { services: { cdAmount: request.codAmount, cdType: "get", cdCurrency: "EUR" } }
          : {}),
      },
      /* Anything other than "calculate" creates the parcel. Spelled out rather
         than left to a default, because the default is the expensive one. */
      mode: "create",
    },
    { allowWrite: true },
  );

  const label = data.label;
  if (!label?.shipmentNumber) {
    throw new Error("Econt accepted the label but returned no shipment number");
  }

  return {
    number: label.shipmentNumber,
    total: label.totalPrice ?? 0,
    currency: label.currency ?? "EUR",
    pdfUrl: label.pdfURL ?? null,
  };
}

/**
 * Cancels a waybill that has not been collected yet.
 *
 * Econt allow this only while the parcel is still theirs to cancel, so a
 * failure here is ordinary rather than exceptional — it usually means the
 * courier already has it, and the answer to the shop is to call them.
 */
export async function cancelWaybill(number: string): Promise<void> {
  await call(
    "Shipments/LabelService.deleteLabels.json",
    { shipmentNumbers: [number] },
    { allowWrite: true },
  );
}
