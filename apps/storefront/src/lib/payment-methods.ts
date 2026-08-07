import "server-only";

/**
 * Whether the shop takes cards yet.
 *
 * Off until myPOS is proven. Nothing has ever been paid through them: the
 * signing is verified against the shop's real keys, but their checkout page
 * has never been opened and the notification that marks an order paid has
 * never run, because it is a server-to-server call and localhost is not
 * reachable from their network. Offering a payment method in that state means
 * a customer reaches a page that may reject them, or worse pays and has the
 * order sit unpaid in the admin.
 *
 * Cash on delivery works end to end and is what the shop runs on meanwhile.
 *
 * A variable rather than deleted code, because the card path is finished and
 * waiting — turning it on should be one line in `.env` and a restart, on a
 * server that cannot rebuild. Set CARD_PAYMENT=on once a real card has been
 * charged and the notification has arrived.
 *
 * Read on the server only. A flag the browser can see is a flag the browser
 * can change, and this one decides whether an order can be sent down a payment
 * path that does not work yet.
 */
export function cardPaymentEnabled(): boolean {
  return process.env.CARD_PAYMENT === "on";
}

export interface PaymentMethodOption {
  value: "cod" | "card";
  label: string;
  note: string;
}

const COD: PaymentMethodOption = {
  value: "cod",
  label: "Наложен платеж",
  note: "без такса",
};

const CARD: PaymentMethodOption = {
  value: "card",
  label: "Плащане с карта",
  note: "чрез myPOS",
};

/** What checkout is allowed to offer. */
export function paymentMethods(): PaymentMethodOption[] {
  return cardPaymentEnabled() ? [COD, CARD] : [COD];
}
