import { BASE_URL } from "./config.js";
import type { Session } from "./session.js";

/** `/category/{id}/{path}` and `/category/{id}/{path}/page/{n}` */
const CATEGORY_URL = /\/category\/(\d+)\//;
/** `/product/{product_id}/{cat_id}/{path}/{slug}-{sku}` */
const PRODUCT_URL = /\/product\/(\d+)\/(\d+)\//;

/**
 * Reads the live navigation and maps every category id to its real URL.
 *
 * The brief lists category ids but not their URL slugs, and the old routes
 * embed a slug we cannot verify. Discovering the URLs costs one request and
 * removes a whole class of silent-empty-run failure.
 */
export async function discoverCategoryUrls(
  session: Session,
): Promise<Map<number, string>> {
  const { html } = await session.fetchPage(BASE_URL);
  await session.livePage.setContent(html);

  const hrefs = await session.livePage.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/category/"]')).map(
      (anchor) => anchor.getAttribute("href") ?? "",
    ),
  );

  const urls = new Map<number, string>();
  for (const href of hrefs) {
    const match = CATEGORY_URL.exec(href);
    if (!match?.[1]) continue;
    const id = Number(match[1]);
    // Keep the first URL seen for an id; later ones are paginated duplicates.
    if (!urls.has(id)) {
      urls.set(id, new URL(href, BASE_URL).toString().replace(/\/page\/\d+\/?$/, ""));
    }
  }
  return urls;
}

export interface ProductLink {
  url: string;
  externalId: string;
}

/**
 * Walks a category's pages collecting product links until `limit` is reached.
 *
 * The old site puts 60 products on a page, so a 30-product target normally
 * costs a single request per category. Pagination stops as soon as a page adds
 * nothing new, which is also what happens when the page number runs past the
 * end and the old site quietly serves page 1 again.
 */
export async function collectProductLinks(
  session: Session,
  categoryUrl: string,
  limit: number,
): Promise<ProductLink[]> {
  const found = new Map<string, ProductLink>();

  for (let pageNumber = 1; found.size < limit; pageNumber += 1) {
    const url = pageNumber === 1 ? categoryUrl : `${categoryUrl.replace(/\/$/, "")}/page/${pageNumber}`;
    const { html } = await session.fetchPage(url);
    await session.livePage.setContent(html);

    const hrefs = await session.livePage.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/product/"]')).map(
        (anchor) => anchor.getAttribute("href") ?? "",
      ),
    );

    const sizeBefore = found.size;
    for (const href of hrefs) {
      const match = PRODUCT_URL.exec(href);
      if (!match?.[1]) continue;
      const absolute = new URL(href, BASE_URL).toString();
      if (!found.has(absolute)) {
        found.set(absolute, { url: absolute, externalId: match[1] });
      }
      if (found.size >= limit) break;
    }

    if (found.size === sizeBefore) break;
  }

  return [...found.values()].slice(0, limit);
}
