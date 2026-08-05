/**
 * Store API client.
 *
 * Plain fetch rather than the Medusa SDK: every read happens in a Server
 * Component, and fetch is what lets Next cache and revalidate them. The SDK
 * would add a dependency and take that control away for no gain here.
 */

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000";
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? "";

/** How long a catalogue read stays fresh. The client edits the catalogue daily
 *  through the bulk module, so this is short enough to feel live and long
 *  enough that a listing page is not a database query per visitor. */
export const CATALOGUE_REVALIDATE_SECONDS = 60;

export class MedusaError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    message: string,
  ) {
    super(`Medusa ${status} on ${path}: ${message}`);
    this.name = "MedusaError";
  }
}

export async function medusaFetch<T>(
  path: string,
  params: Record<string, string | number | string[] | undefined> = {},
): Promise<T> {
  const url = new URL(path, BACKEND_URL);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    // Medusa takes repeated keys for array filters, not comma-joined values.
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(key, item);
    } else {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    headers: {
      "x-publishable-api-key": PUBLISHABLE_KEY,
      accept: "application/json",
    },
    next: { revalidate: CATALOGUE_REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    throw new MedusaError(
      response.status,
      url.pathname,
      await response.text().catch(() => response.statusText),
    );
  }

  return response.json() as Promise<T>;
}

/**
 * Anything that changes state: creating a cart, adding a line, setting an
 * address.
 *
 * Deliberately separate from `medusaFetch` rather than a flag on it, because
 * the two have opposite caching needs and mixing them is how a cart ends up
 * served from cache to the wrong shopper. This one is always `no-store`.
 */
export async function medusaMutate<T>(
  path: string,
  options: {
    method?: "POST" | "DELETE";
    body?: unknown;
    query?: Record<string, string | number | undefined>;
  } = {},
): Promise<T> {
  const url = new URL(path, BACKEND_URL);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    method: options.method ?? "POST",
    headers: {
      "x-publishable-api-key": PUBLISHABLE_KEY,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new MedusaError(
      response.status,
      url.pathname,
      await response.text().catch(() => response.statusText),
    );
  }

  return response.json() as Promise<T>;
}

/** A read that must not be cached — a cart belongs to one shopper. */
export async function medusaFetchFresh<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  const url = new URL(path, BACKEND_URL);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: {
      "x-publishable-api-key": PUBLISHABLE_KEY,
      accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new MedusaError(
      response.status,
      url.pathname,
      await response.text().catch(() => response.statusText),
    );
  }

  return response.json() as Promise<T>;
}

/** True when the backend is reachable and configured. Used to tell a genuinely
 *  empty catalogue apart from a backend that is simply not running, which are
 *  very different things to show a visitor. */
export function isMedusaConfigured(): boolean {
  return PUBLISHABLE_KEY !== "";
}
