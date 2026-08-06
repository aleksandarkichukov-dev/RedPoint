import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

/**
 * "Where is my order?" — number plus email, nothing else.
 *
 * This is the one route in the shop that reveals somebody's order to whoever
 * asks, so it is built to give away as little as possible:
 *
 *   Both must match. The number alone is guessable — orders count up from 1 —
 *   and the email alone would list a stranger's purchases. Together they are a
 *   pair somebody either has or does not.
 *
 *   Wrong number, wrong email and missing order all answer the same way. A
 *   distinct "no such order" would confirm which numbers exist, and a distinct
 *   "wrong email" would confirm that an order belongs to an address someone is
 *   guessing at.
 *
 *   The answer carries the status, the total and the delivery method. Not the
 *   address, not the phone, not the items. Someone who already has the number
 *   and the email learns whether their parcel has left; someone who guessed a
 *   pair learns nothing worth having.
 *
 *   Ten attempts per address per five minutes. Guessing a five-digit number
 *   against a known email is minutes of work without it.
 */

const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 10;

const attempts = new Map<string, { count: number; since: number }>();

/* In memory, so it resets on restart and does not survive across the instances
   a bigger deployment would have. That is a real limit and worth naming: it
   slows down guessing rather than stopping it, and the day this runs behind
   more than one process it belongs in Redis, which is already here. */
function tooManyAttempts(key: string): boolean {
  const now = Date.now();
  const seen = attempts.get(key);

  if (!seen || now - seen.since > WINDOW_MS) {
    attempts.set(key, { count: 1, since: now });
    return false;
  }

  seen.count += 1;
  return seen.count > MAX_ATTEMPTS;
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const body = req.body as { orderNumber?: unknown; email?: unknown };
  const orderNumber = Number(body?.orderNumber);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!Number.isInteger(orderNumber) || orderNumber < 1 || !email.includes("@")) {
    res.status(400).json({ message: "Трябват номер на поръчката и имейлът, с който е направена." });
    return;
  }

  if (tooManyAttempts(email)) {
    res.status(429).json({
      message: "Твърде много опити. Опитайте пак след няколко минути или се обадете в магазина.",
    });
    return;
  }

  /* Not found and wrong email are the same answer, deliberately. */
  const deny = () =>
    res.status(404).json({
      message:
        "Не намирам такава поръчка. Проверете номера и имейла — те са в писмото с потвърждението.",
    });

  try {
    const { data } = await query.graph({
      entity: "order",
      filters: { display_id: orderNumber },
      /* `payment_status` and `fulfillment_status` are asked for here in every
         Medusa example and `query.graph` drops both without a word — the
         result simply does not contain them, so a naive read gets `undefined`
         and reports every order as unpaid and unshipped. Both are derived
         below from what does come back. */
      fields: [
        "id",
        "display_id",
        "email",
        "status",
        "created_at",
        "total",
        "currency_code",
        "shipping_methods.*",
        "items.*",
        "fulfillments.*",
        "payment_collections.status",
      ],
    });

    const order = data[0];
    if (!order || (order.email ?? "").toLowerCase() !== email) {
      deny();
      return;
    }

    const fulfillments = (order.fulfillments ?? []) as { shipped_at?: string | null }[];

    res.json({
      order: {
        displayId: order.display_id,
        placedAt: order.created_at,
        status: order.status,
        /* A fulfillment exists once the parcel is packed; `shipped_at` is set
           when it leaves. Those are two different sentences to a shopper, so
           they stay two different states rather than one "fulfilled". */
        shipped: fulfillments.some((entry) => Boolean(entry.shipped_at)),
        packed: fulfillments.length > 0,
        paid: order.payment_collections?.[0]?.status === "completed",
        total: Number(order.total ?? 0),
        currencyCode: order.currency_code,
        shippingMethod: order.shipping_methods?.[0]?.name ?? null,
        itemCount: (order.items ?? []).reduce(
          (sum: number, item: { quantity?: number }) => sum + Number(item.quantity ?? 0),
          0,
        ),
      },
    });
  } catch (error) {
    logger.error(`order lookup failed: ${error}`);
    res.status(500).json({ message: "Справката не можа да бъде направена." });
  }
}
