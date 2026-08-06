import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * What a crawler should not spend its time on.
 *
 * Not a security measure — nothing here is secret, and a `Disallow` is a
 * request rather than a lock. It is about attention: every site gets a finite
 * amount of crawling, and a basket, a checkout and a component gallery consume
 * it while answering no search anybody performs.
 *
 * The favourites page and the order pages are per-shopper. Indexed, they would
 * put somebody's empty basket in the results under the shop's name.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/cart", "/checkout", "/order", "/wishlist", "/design-system", "/api"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
