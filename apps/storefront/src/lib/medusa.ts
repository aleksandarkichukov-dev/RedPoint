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

/** True when the backend is reachable and configured. Used to tell a genuinely
 *  empty catalogue apart from a backend that is simply not running, which are
 *  very different things to show a visitor. */
export function isMedusaConfigured(): boolean {
  return PUBLISHABLE_KEY !== "";
}
