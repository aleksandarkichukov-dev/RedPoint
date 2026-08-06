import type { MetadataRoute } from "next";
import { getRegionId, listCategories, listProducts, productHref } from "@/lib/catalog";
import { absolute } from "@/lib/site";

/**
 * Everything worth finding, listed for a crawler.
 *
 * Without it a search engine has to discover the catalogue by following links
 * from the front page, which it does slowly and incompletely. This shop's
 * client changes stock daily, so "slowly" is the part that matters: a garment
 * uploaded this morning should be findable this week, not next month.
 *
 * Priorities are relative, not absolute — they say which of OUR pages matter
 * most, and nothing about how we compare to anybody else. Products lead
 * because they are what somebody searches for; the help pages are here so they
 * are indexed at all, not because anybody searches for a returns policy.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const fixed: MetadataRoute.Sitemap = [
    { url: absolute("/"), lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: absolute("/help/delivery"), changeFrequency: "yearly", priority: 0.3 },
    { url: absolute("/help/returns"), changeFrequency: "yearly", priority: 0.3 },
    { url: absolute("/help/sizes"), changeFrequency: "yearly", priority: 0.3 },
    { url: absolute("/help/contact"), changeFrequency: "monthly", priority: 0.5 },
  ];

  try {
    const regionId = await getRegionId();
    const [categories, { products }] = await Promise.all([
      listCategories(),
      listProducts({ regionId, limit: 100 }),
    ]);

    /* Leaves only. A parent category renders the same products as its children
       and would ask a crawler to read the catalogue twice. */
    const leaves = categories.filter(
      (category) => !categories.some((other) => other.parent_category_id === category.id),
    );

    return [
      ...fixed,
      ...leaves.map((category) => ({
        url: absolute(`/${category.handle}`),
        lastModified: now,
        changeFrequency: "daily" as const,
        priority: 0.7,
      })),
      ...products.map((product) => ({
        url: absolute(productHref(product)),
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ];
  } catch {
    /* The backend being down must not publish an empty sitemap. A crawler
       reading one concludes the shop has five pages, and that conclusion
       outlives the outage by weeks. Better to serve the pages we can name
       from nothing but code. */
    return fixed;
  }
}
