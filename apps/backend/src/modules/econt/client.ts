/**
 * Econt JSON API client.
 *
 * Basic authentication, one POST per method, and the method name lives in the
 * path: `Nomenclatures/NomenclaturesService.getOffices.json`.
 *
 * Two systems, chosen by `COURIERS_SANDBOX`:
 *
 *   demo.econt.com/ee/services/   test, open, public credentials
 *   ee.econt.com/services/        production, real and billed
 *
 * The demo is genuinely useful rather than a stub — it answers with Econt's
 * real 585 offices — so the whole module is written and checked against it
 * before anything touches the shop's account.
 *
 * Read and write are split the same way as the Speedy client, and for the same
 * reason: `createAWB` registers a real parcel that a courier will come and
 * collect. `call` refuses anything on the write list unless the caller passes
 * `allowWrite` and means it.
 */

const DEMO_URL = "https://demo.econt.com/ee/services";
const LIVE_URL = "https://ee.econt.com/services";

/** Econt's own public demo login, from their documentation. Not a secret. */
const DEMO_CREDENTIALS = { username: "iasp-dev", password: "1Asp-dev" };

/** Methods that create or change something at Econt rather than reading. */
const WRITE_METHODS = [
  "Shipments/LabelService.createLabel",
  "Shipments/LabelService.deleteLabels",
  "Shipments/ShipmentService.requestCourier",
  "OrdersService.createAWB",
  "OrdersService.updateOrder",
];

/**
 * Digs the real message out of Econt's nested errors.
 *
 * They answer a rejected label with `message: " "` at the top and the actual
 * reason three levels down, inside `innerErrors` inside `innerErrors`. Reading
 * only the top level reports a blank string, which is worse than reporting
 * nothing — it looks like the call succeeded and returned nothing.
 *
 * The deepest message is the specific one: "подател:" wraps a blank wrapper
 * which wraps "Несъответствие между населено място и пощенски код."
 */
function deepestMessage(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const node = error as { message?: string; innerErrors?: unknown[] };

  for (const inner of node.innerErrors ?? []) {
    const deeper = deepestMessage(inner);
    if (deeper) return deeper;
  }

  const own = node.message?.trim();
  return own ? own : null;
}

export class EcontConfigError extends Error {
  constructor(message: string) {
    super(`Econt is not configured: ${message}`);
    this.name = "EcontConfigError";
  }
}

export class EcontApiError extends Error {
  constructor(
    readonly method: string,
    readonly status: number | undefined,
    message: string,
  ) {
    super(`Econt ${method} failed${status ? ` (${status})` : ""}: ${message}`);
    this.name = "EcontApiError";
  }
}

/** True while the shop is pointed at the demo system. */
export function isSandbox(): boolean {
  return process.env.COURIERS_SANDBOX !== "false";
}

export interface EcontCredentials {
  username: string;
  password: string;
}

/**
 * The demo's own login in sandbox, the shop's in production.
 *
 * Deliberately not "the shop's credentials, falling back to the demo's". A
 * fallback would let a missing variable look like a working integration, and
 * the day someone reads offices from the demo while creating labels against
 * the real account is the day a parcel goes to an address that does not exist.
 */
export function getEcontCredentials(): EcontCredentials {
  if (isSandbox()) return DEMO_CREDENTIALS;

  const username = process.env.ECONT_USERNAME;
  const password = process.env.ECONT_PASSWORD;

  if (!username) throw new EcontConfigError("ECONT_USERNAME is not set");
  if (!password) throw new EcontConfigError("ECONT_PASSWORD is not set");

  return { username, password };
}

export function getShopId(): string {
  const shopId = process.env.ECONT_SHOP_ID;
  if (!shopId) throw new EcontConfigError("ECONT_SHOP_ID is not set");
  return shopId;
}

export async function call<T>(
  method: string,
  payload: Record<string, unknown> = {},
  options: { allowWrite?: boolean } = {},
): Promise<T> {
  /* `createLabel` both quotes and creates, told apart by one field in the body.
     That is Econt's design, not ours, and it is the sharpest edge in this API:
     the same call that prices a delivery registers a parcel if `mode` is
     anything else. So the guard reads the mode rather than the method name —
     a quote is a read however alarming the URL looks. */
  const isQuote = payload.mode === "calculate";
  const isWrite = !isQuote && WRITE_METHODS.some((name) => method.startsWith(name));
  if (isWrite && !options.allowWrite) {
    throw new EcontApiError(
      method,
      undefined,
      "this method creates or changes a real shipment; pass allowWrite to mean it",
    );
  }

  const { username, password } = getEcontCredentials();
  const base = isSandbox() ? DEMO_URL : LIVE_URL;
  const auth = Buffer.from(`${username}:${password}`).toString("base64");

  const response = await fetch(`${base}/${method}`, {
    method: "POST",
    headers: {
      authorization: `Basic ${auth}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new EcontApiError(method, response.status, text.slice(0, 200));
  }

  /* Econt answer 517 with a `message` for a rejected login rather than 401, and
     they put `message` on ordinary failures too — sometimes blank at the top
     with the reason buried in `innerErrors`. Reading it before the status is
     what turns a bare number into "Невалидно потребителско име и/или парола". */
  const failure = data as { message?: string; type?: string; innerErrors?: unknown[] };
  if (failure.message !== undefined || failure.type) {
    throw new EcontApiError(
      method,
      response.status,
      deepestMessage(failure) ?? failure.type ?? "unknown error",
    );
  }

  if (!response.ok) {
    throw new EcontApiError(method, response.status, text.slice(0, 200));
  }

  return data as T;
}
