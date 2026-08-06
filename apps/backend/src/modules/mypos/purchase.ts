import { getMyposConfig } from "./config";
import { sign, type MyposParams } from "./signature";

/**
 * Builds the signed IPCPurchase form that sends a shopper to the myPOS page.
 *
 * The parameter ORDER is not cosmetic. myPOS builds the signature by joining
 * the values in the order they appear, so the object below has to be written
 * in the order myPOS document and sent in that same order. Reordering these
 * lines silently breaks every payment.
 */

/** Money arrives from Medusa as a BigNumber, which is a string or an object. */
type Money = number | string;

export interface PurchaseLine {
  name: string;
  quantity: number;
  /** Unit price, tax inclusive, as the shopper saw it. */
  unitPrice: Money;
}

export interface PurchaseRequest {
  orderId: string;
  /** Goods only. Delivery is a separate field myPOS adds to the total. */
  itemsTotal: Money;
  deliveryTotal: Money;
  currency: string;
  lines: PurchaseLine[];
  customer: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    city?: string;
    postalCode?: string;
    address?: string;
  };
}

/**
 * myPOS wants plain decimals with two places, not locale-formatted money.
 *
 * Coerces rather than trusting the type. Medusa hands money back as BigNumber
 * values that are objects or strings depending on the query, and calling
 * toFixed on one throws deep inside the request builder — where the message
 * says nothing about money.
 */
function amount(value: number | string, field: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    // Names the field. "null is not an amount" alone sends you reading the
    // whole builder to work out which of eight money values was missing.
    throw new Error(`myPOS purchase: ${field} is ${JSON.stringify(value)}, not an amount`);
  }
  return numeric.toFixed(2);
}

export interface SignedPurchase {
  /** Where the browser POSTs. */
  url: string;
  /** Fields to render as hidden inputs, in this exact order. */
  fields: MyposParams;
}

export function buildPurchase(request: PurchaseRequest): SignedPurchase {
  const config = getMyposConfig();

  /* URL_Notify is the one that authorises the payment. myPOS say it plainly:
     do not rely on the browser coming back to URL_OK, because a shopper can
     close the tab and a hostile one can call it themselves. The server-to-
     server notify is the truth, and it is verified by signature. */
  const fields: MyposParams = {
    IPCmethod: "IPCPurchase",
    IPCVersion: "1.4",
    IPCLanguage: "BG",
    SID: config.sid,
    WalletNumber: config.wallet,
    KeyIndex: config.keyIndex,
    Amount: amount(Number(request.itemsTotal) + Number(request.deliveryTotal), "Amount"),
    Currency: request.currency.toUpperCase(),
    OrderID: request.orderId,
    URL_OK: `${config.storefrontUrl}/order/confirm/${request.orderId}`,
    /* The order, not the checkout. By the time myPOS have the shopper the
       order already exists and the cart is spent, so /checkout would redirect
       them to an empty basket — the shop losing their order in front of them.
       The pay page is worse still: it auto-submits, so cancelling would send
       them straight back to myPOS in a loop. */
    URL_Cancel: `${config.storefrontUrl}/order/${request.orderId}?payment=cancelled`,
    // /hooks, not /store: Medusa's store routes demand a publishable API key
    // that myPOS cannot send. See the route file.
    URL_Notify: `${config.backendUrl}/hooks/mypos/notify`,
    /* 1 means the customer details below are supplied by us, so the shopper is
       not asked to retype what checkout already collected. */
    PaymentParametersRequired: "1",
    CustomerEmail: request.customer.email,
    CustomerFirstNames: request.customer.firstName,
    CustomerFamilyName: request.customer.lastName,
    CustomerPhone: request.customer.phone ?? "",
    CustomerCountry: "BGR",
    CustomerCity: request.customer.city ?? "",
    CustomerZIPCode: request.customer.postalCode ?? "",
    CustomerAddress: request.customer.address ?? "",
    CartItems: String(request.lines.length),
  };

  request.lines.forEach((line, index) => {
    const n = index + 1;
    fields[`Article_${n}`] = line.name;
    fields[`Quantity_${n}`] = String(line.quantity);
    fields[`Price_${n}`] = amount(line.unitPrice, `Price_${n}`);
    fields[`Amount_${n}`] = amount(Number(line.unitPrice) * line.quantity, `Amount_${n}`);
    fields[`Currency_${n}`] = request.currency.toUpperCase();
  });

  fields.Delivery = amount(request.deliveryTotal, "Delivery");
  fields.Signature = sign(fields, config.privateKey);

  return { url: config.checkoutUrl, fields };
}
