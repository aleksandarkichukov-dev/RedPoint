/**
 * Where this shop lives on the internet.
 *
 * Everything that has to be an absolute URL — the sitemap, the canonical tags,
 * the images Facebook and Viber read, the JSON-LD Google reads — comes through
 * here rather than being written out per file. When the domain is decided, it
 * changes in one place.
 *
 * The fallback is the real domain rather than localhost on purpose. A sitemap
 * accidentally published listing `http://localhost:3000/...` is worse than one
 * listing a domain that is not live yet: the first is nonsense to every crawler
 * that reads it, the second becomes correct the day the site is deployed.
 */
export const SITE_URL = (
  process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://redpointbg.com"
).replace(/\/+$/, "");

/**
 * The old domain, which is not this one.
 *
 * red-point.bg carries ten years of search authority and every link anyone has
 * ever made to this shop. It is not being reused: the new address is
 * redpointbg.com. That makes the 301 map in next.config.ts load-bearing in a
 * way it would not be for a same-domain move — the rules match on path alone,
 * so they only ever fire for requests that reach this server, which means
 * red-point.bg has to point here too. Pointed anywhere else, or at nothing,
 * every one of those ten years is discarded.
 */
export const LEGACY_DOMAIN = "red-point.bg";

export function absolute(path: string): string {
  return new URL(path, `${SITE_URL}/`).toString();
}
