import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { PATHS } from "./config.js";

/**
 * Resumable on-disk cache.
 *
 * Cloudflare will block this crawl at some point. When it does, the run must
 * pick up where it stopped rather than replay hundreds of requests, so every
 * fetched page is written to disk and every finished product is recorded in
 * state.json. Deleting `.cache/` forces a clean re-crawl.
 */

export interface ScrapeState {
  /** Product URLs already parsed successfully. */
  doneProducts: string[];
  /** Category key -> product URLs discovered for it. */
  categoryProducts: Record<string, string[]>;
  startedAt: string;
  updatedAt: string;
}

const EMPTY_STATE: ScrapeState = {
  doneProducts: [],
  categoryProducts: {},
  startedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function keyFor(url: string): string {
  return createHash("sha1").update(url).digest("hex");
}

export async function ensureDirs(): Promise<void> {
  await Promise.all(
    [
      PATHS.cache,
      PATHS.pages,
      PATHS.parsedProducts,
      PATHS.seed,
      PATHS.images,
      PATHS.reports,
    ].map((dir) => fs.mkdir(dir, { recursive: true })),
  );
}

/**
 * Parsed products are cached individually, not just the raw HTML.
 *
 * Product pages have to be visited live (the size list only updates once a
 * colour swatch is clicked, which needs real JS), so replaying cached HTML
 * would not reproduce them. Caching the finished object instead means an
 * interrupted run never re-visits a product it already understood.
 */
export async function readParsedProduct<T>(url: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(
      path.join(PATHS.parsedProducts, `${keyFor(url)}.json`),
      "utf8",
    );
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeParsedProduct(url: string, product: unknown): Promise<void> {
  await fs.writeFile(
    path.join(PATHS.parsedProducts, `${keyFor(url)}.json`),
    JSON.stringify(product, null, 2),
    "utf8",
  );
}

export async function readCachedPage(url: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(PATHS.pages, `${keyFor(url)}.html`), "utf8");
  } catch {
    return null;
  }
}

export async function writeCachedPage(url: string, html: string): Promise<void> {
  await fs.writeFile(path.join(PATHS.pages, `${keyFor(url)}.html`), html, "utf8");
}

export async function loadState(): Promise<ScrapeState> {
  try {
    const raw = await fs.readFile(PATHS.state, "utf8");
    return { ...EMPTY_STATE, ...(JSON.parse(raw) as Partial<ScrapeState>) };
  } catch {
    return { ...EMPTY_STATE };
  }
}

export async function saveState(state: ScrapeState): Promise<void> {
  state.updatedAt = new Date().toISOString();
  await fs.writeFile(PATHS.state, JSON.stringify(state, null, 2), "utf8");
}
