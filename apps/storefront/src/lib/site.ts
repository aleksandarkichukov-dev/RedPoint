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
  process.env.NEXT_PUBLIC_SITE_URL || "https://red-point.bg"
).replace(/\/+$/, "");

export function absolute(path: string): string {
  return new URL(path, `${SITE_URL}/`).toString();
}
