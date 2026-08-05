/**
 * Speedy Web API client.
 *
 * Speedy authenticate every single call, offices included — there is no public
 * endpoint. Credentials go in the JSON body of each request, not in a header,
 * which is unusual enough to be worth stating: `userName` and `password` are
 * merged into every payload by `call` below.
 *
 * Read and write are split deliberately. `call` will refuse anything on the
 * write list unless the caller passes `allowWrite`, because creating a shipment
 * at Speedy is a real act — it registers a parcel and it is billable. A typo in
 * a test should not cost the shop a courier pickup.
 */

const BASE_URL = "https://api.speedy.bg/v1";

/** Endpoints that change something at Speedy rather than just reading. */
const WRITE_ENDPOINTS = ["/shipment", "/shipment/cancel", "/pickup", "/print"];

export class SpeedyConfigError extends Error {
  constructor(message: string) {
    super(`Speedy is not configured: ${message}`);
    this.name = "SpeedyConfigError";
  }
}

export class SpeedyApiError extends Error {
  constructor(
    readonly endpoint: string,
    readonly code: string | number | undefined,
    message: string,
  ) {
    super(`Speedy ${endpoint} failed${code ? ` (${code})` : ""}: ${message}`);
    this.name = "SpeedyApiError";
  }
}

export interface SpeedyCredentials {
  userName: string;
  password: string;
  clientNumber: string;
}

export function getSpeedyCredentials(): SpeedyCredentials {
  const userName = process.env.SPEEDY_USERNAME;
  const password = process.env.SPEEDY_PASSWORD;
  const clientNumber = process.env.SPEEDY_CLIENT_NUMBER;

  if (!userName) throw new SpeedyConfigError("SPEEDY_USERNAME is not set");
  if (!password) throw new SpeedyConfigError("SPEEDY_PASSWORD is not set");
  if (!clientNumber) throw new SpeedyConfigError("SPEEDY_CLIENT_NUMBER is not set");

  return { userName, password, clientNumber };
}

export async function call<T>(
  endpoint: string,
  payload: Record<string, unknown> = {},
  options: { allowWrite?: boolean } = {},
): Promise<T> {
  const isWrite = WRITE_ENDPOINTS.some((path) => endpoint.startsWith(path));
  if (isWrite && !options.allowWrite) {
    throw new SpeedyApiError(
      endpoint,
      undefined,
      "this endpoint creates or changes a real shipment; pass allowWrite to mean it",
    );
  }

  const { userName, password } = getSpeedyCredentials();

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userName, password, ...payload }),
  });

  if (!response.ok) {
    throw new SpeedyApiError(endpoint, response.status, await response.text().catch(() => ""));
  }

  const data = (await response.json()) as T & {
    error?: { code?: number; message?: string; context?: string };
  };

  /* Speedy answer 200 with an `error` object rather than an HTTP status, so a
     naive caller treats a rejected login as a successful empty result. */
  if (data.error) {
    throw new SpeedyApiError(
      endpoint,
      data.error.code,
      data.error.message ?? data.error.context ?? "unknown error",
    );
  }

  return data;
}
