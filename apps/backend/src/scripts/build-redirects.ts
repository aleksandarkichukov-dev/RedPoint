import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { ExecArgs } from "@medusajs/framework/types";
import { flattenCategories } from "@redpoint/catalog";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * Builds the 301 map from the old red-point.bg URLs to this shop's.
 *
 *   medusa exec ./src/scripts/build-redirects.ts
 *
 * The domain is ten years old and everything it ranks for points at URLs that
 * will not exist on the new site. Without these, the shop launches having
 * thrown that away — which is the one part of a migration that cannot be
 * repaired later by working harder.
 *
 * A generated file rather than a live lookup. Redirects have to answer before
 * anything else does, including a database that might be down, and a
 * checked-in file is also something a person can read and argue with.
 *
 * Two shapes, both keyed on a number so no Cyrillic ever appears in a match
 * pattern:
 *
 *   /product/{id}/{colour}/Мъже/Якета/{slug}   ->  /p/{handle}
 *   /category/{id}/...                          ->  /{handle}
 *
 * The id in a product URL belongs to the product, not to the colour, so one
 * entry catches every colour variant of it — including the ones the scraper
 * never visited.
 */

interface ScrapedProduct {
  /** The old site's product id: the first number in its URL. */
  externalId: string;
  /** The article number, which is what this shop keys a product by. */
  sku: string;
  url: string;
  categoryKeys?: string[];
}

export default async function buildRedirects({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const root = resolve(process.cwd(), "../..");
  const raw = await readFile(resolve(root, "seed/products.json"), "utf8");
  const parsed = JSON.parse(raw);
  const scraped: ScrapedProduct[] = Array.isArray(parsed) ? parsed : (parsed.products ?? []);

  /* What the shop actually holds today, not what was scraped. Nine of the
     ninety-seven have since been pruned, and a 301 to a product that no longer
     exists is worse than none: it spends the old page's standing on a 404. */
  const { data: live } = await query.graph({
    entity: "product",
    fields: ["handle", "external_id", "categories.handle"],
  });

  const byArticle = new Map<string, { handle: string; categoryHandle: string | null }>();
  for (const product of live) {
    if (!product.external_id) continue;
    byArticle.set(String(product.external_id), {
      handle: product.handle,
      categoryHandle: product.categories?.[0]?.handle ?? null,
    });
  }

  const categories = flattenCategories();
  const categoryHandleByKey = new Map(categories.map((c) => [c.key, c.key]));
  const categoryIdByKey = new Map(categories.map((c) => [c.key, c.id]));

  /* The old URL names its own category, in Bulgarian, in its fourth segment:
     /product/{id}/{colour}/Мъже/Тениски/{slug}. That is a better source than
     the scraped categoryKeys, which for a discontinued product often say only
     "men-sale" — a category the client asked us to drop, so it resolves to
     nothing while the URL plainly says these were t-shirts. */
  const normalise = (name: string) => name.toLowerCase().replace(/[\s-]+/g, "-");
  const keyByName = new Map(categories.map((c) => [normalise(c.name), c.key]));

  const productRules: { from: number; to: string }[] = [];
  let gone = 0;
  let homed = 0;

  for (const product of scraped) {
    const oldId = Number(product.externalId);
    if (!Number.isFinite(oldId)) continue;

    const current = byArticle.get(String(product.sku));
    if (current) {
      productRules.push({ from: oldId, to: `/p/${current.handle}` });
      continue;
    }

    /* Discontinued. Its category is the honest answer — somebody who searched
       for a jacket we no longer carry is better served by the jackets than by
       an apology, and the link keeps its value instead of dying. */
    const segments = decodeURIComponent(new URL(product.url).pathname).split("/").filter(Boolean);

    /* The gender segment has to agree before the category name is trusted.
       "Бельо" exists under both Мъже and Жени on the old site, and matching on
       the name alone sent three women's briefs to the men's underwear page —
       a redirect that works, returns 200, and is wrong. The tree holds only
       men's categories, so anything else is not ours to match. */
    const isMens = segments[3] ? normalise(segments[3]) === "мъже" : false;
    const fromUrl = isMens && segments[4] ? keyByName.get(normalise(segments[4])) : undefined;
    const fromKeys = (product.categoryKeys ?? []).find(
      (candidate) => candidate !== "men-sale" && categoryHandleByKey.has(candidate),
    );
    const key = fromUrl ?? fromKeys;

    if (key) {
      productRules.push({ from: oldId, to: `/${key}` });
      gone += 1;
      continue;
    }

    /* No category either — these are the women's items, and the client dropped
       that whole branch. There is no more specific truthful destination than
       the front page: the shop still exists, that part of it does not. */
    productRules.push({ from: oldId, to: "/" });
    homed += 1;
  }

  /* Old category pages. Their ids are in the tree because the scraper needed
     them to crawl; the same numbers are what the old URLs carry. */
  const categoryRules = flattenCategories()
    .filter((category) => categoryIdByKey.has(category.key))
    .map((category) => ({ from: category.id, to: `/${category.key}` }));

  const file = `/* Generated by apps/backend/src/scripts/build-redirects.ts — do not edit.
 *
 * The old red-point.bg URLs, and where each one now lives. Regenerate after
 * the catalogue changes shape; a discontinued product's rule moves from the
 * product to its category, and only this file knows the difference.
 *
 * Keyed on the numeric id alone, so no Cyrillic appears in a match pattern.
 * The old URLs carry percent-encoded Cyrillic in later segments and matching
 * those reliably across proxies is a fight worth not having.
 */

export interface OldUrlRedirect {
  /** The old site's numeric id, first path segment after /product or /category. */
  id: number;
  /** Where it goes now, as a path on this site. */
  to: string;
}

/** ${productRules.length} products (${gone} discontinued, sent to their category). */
export const PRODUCT_REDIRECTS: OldUrlRedirect[] = [
${productRules.map((rule) => `  { id: ${rule.from}, to: ${JSON.stringify(rule.to)} },`).join("\n")}
];

/** ${categoryRules.length} category pages. */
export const CATEGORY_REDIRECTS: OldUrlRedirect[] = [
${categoryRules.map((rule) => `  { id: ${rule.from}, to: ${JSON.stringify(rule.to)} },`).join("\n")}
];
`;

  const target = resolve(root, "apps/storefront/src/lib/old-urls.generated.ts");
  await writeFile(target, file, "utf8");

  logger.info(`продукти:   ${productRules.length}`);
  logger.info(`  от които: ${gone} отпаднали -> към категорията им`);
  logger.info(`            ${homed} без категория в новия сайт -> към началната`);
  logger.info(`категории:  ${categoryRules.length}`);
  logger.info(`записано в ${target}`);
}
