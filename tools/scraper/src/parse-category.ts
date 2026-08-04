import { BASE_URL } from "./config.js";
import type { Session } from "./session.js";

/** `/category/{id}/{path}` and `/category/{id}/{path}/page/{n}` */
const CATEGORY_URL = /\/category\/(\d+)\//;

/**
 * `/product/{product_id}/{colour_id}/{path}/{slug}-{sku}`
 *
 * The brief documents the second segment as a category id. It is not: it is the
 * COLOUR. A three-colour product is three separate URLs sharing one product id
 * and one sku, each rendering only that colour's photography and sizes. That is
 * why there is no swatch row to find on the page.
 */
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
  const home = await session.fetchPage(BASE_URL);
  if (!home) throw new Error("could not load the home page to discover categories");
  await session.livePage.setContent(home.html);

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
  /** `product_id`, shared by every colour of the same product. */
  externalId: string;
  /** `colour_id`, the second URL segment. */
  colorId: string;
}

/**
 * Walks a category's pages collecting product links until `limit` is reached.
 *
 * The old site puts 60 products on a page, so any target under that costs a
 * single request per category. Pagination stops when the limit is reached, when
 * a page adds nothing new, or when the next page 404s because the category is
 * smaller than the limit. A category with three products yields three; it is
 * not an error.
 */
export async function collectProductLinks(
  session: Session,
  categoryUrl: string,
  limit: number,
): Promise<ProductLink[]> {
  const found = new Map<string, ProductLink>();

  for (let pageNumber = 1; ; pageNumber += 1) {
    const url = pageNumber === 1 ? categoryUrl : `${categoryUrl.replace(/\/$/, "")}/page/${pageNumber}`;

    /* A category with fewer products than the limit has no page 2, and asking
       for one returns 404. That is the normal way to learn a category is
       small, so it ends pagination with whatever was collected rather than
       failing the crawl. */
    const page = await session.fetchPage(url, { missingIsOk: pageNumber > 1 });
    if (!page) break;

    const { html } = page;
    await session.livePage.setContent(html);

    const hrefs = await session.livePage.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/product/"]')).map(
        (anchor) => anchor.getAttribute("href") ?? "",
      ),
    );

    const sizeBefore = found.size;
    const productIds = new Set([...found.values()].map((link) => link.externalId));
    for (const href of hrefs) {
      const match = PRODUCT_URL.exec(href);
      if (!match?.[1] || !match[2]) continue;
      /* The limit counts PRODUCTS, not urls. A three-colour product is three
         urls, so a new colour of an already-accepted product is always taken;
         only a NEW product is turned away once the limit is reached. Cutting
         mid-product would ship a partial colour set. */
      if (!productIds.has(match[1]) && productIds.size >= limit) continue;
      productIds.add(match[1]);
      const absolute = new URL(href, BASE_URL).toString();
      if (!found.has(absolute)) {
        found.set(absolute, { url: absolute, externalId: match[1], colorId: match[2] });
      }
    }

    // Enough products, or this page added nothing: either way, stop.
    if (productIds.size >= limit || found.size === sizeBefore) break;
  }

  return [...found.values()];
}

/**
 * Other colours of the product currently loaded, taken from the links the page
 * already carries. Costs no extra request, and catches colours that the
 * category listing happened not to show.
 */
export async function readSiblingColorLinks(
  session: Session,
  link: ProductLink,
): Promise<ProductLink[]> {
  const hrefs = await session.livePage.evaluate((productId) => {
    const pattern = new RegExp(`/product/${productId}/`);
    return Array.from(document.querySelectorAll<HTMLAnchorElement>("a"))
      .map((anchor) => anchor.getAttribute("href") ?? "")
      .filter((href) => pattern.test(href));
  }, link.externalId);

  const siblings = new Map<string, ProductLink>();
  for (const href of hrefs) {
    const match = PRODUCT_URL.exec(href);
    if (!match?.[1] || !match[2]) continue;
    if (match[2] === link.colorId) continue;
    const absolute = new URL(href, BASE_URL).toString();
    siblings.set(absolute, { url: absolute, externalId: match[1], colorId: match[2] });
  }
  return [...siblings.values()];
}
