import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = path.resolve(here, "../../..");
export const SCRAPER_ROOT = path.resolve(here, "..");

export const PATHS = {
  cache: path.join(SCRAPER_ROOT, ".cache"),
  pages: path.join(SCRAPER_ROOT, ".cache", "pages"),
  parsedProducts: path.join(SCRAPER_ROOT, ".cache", "products"),
  state: path.join(SCRAPER_ROOT, ".cache", "state.json"),
  seed: path.join(REPO_ROOT, "seed"),
  images: path.join(REPO_ROOT, "seed", "images"),
  products: path.join(REPO_ROOT, "seed", "products.json"),
  reports: path.join(REPO_ROOT, "seed", "reports"),
} as const;

export const BASE_URL = "https://red-point.bg";

export const CONFIG = {
  /** Cloudflare in front of the old site starts blocking after roughly ten
   *  rapid requests, so every navigation is serial and spaced out. Jitter
   *  keeps the interval from looking like a metronome. */
  throttleMinMs: 1500,
  throttleMaxMs: 2000,

  /** Per the brief: enough of each category to seed a realistic catalogue.
   *  The client adds the rest through the Phase 7 bulk module. */
  productsPerCategory: 30,

  /** Navigations are retried on transient failures, with a long cool-off in
   *  case the retry was caused by rate limiting rather than a flaky socket. */
  maxRetries: 3,
  retryCooldownMs: 30_000,

  navigationTimeoutMs: 45_000,

  /** Image downloads get a much lighter interval than page navigations.
   *  They are static assets that Cloudflare serves from cache rather than
   *  challenging, and at the page rate a full run would take hours. Raise this
   *  if the run starts collecting 403s on images specifically. */
  imageThrottleMs: 300,
  imageTimeoutMs: 30_000,

  /** Original-resolution image variant. The old site also emits 99x98 and
   *  502x616; those are throwaway. */
  imageResolution: "2000h",

  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
} as const;
