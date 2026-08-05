"use server";

import { getRegionId, listProductsByHandles, toCardProps } from "@/lib/catalog";
import type { ProductCardProps } from "@/components/ui/product-card";

/**
 * The favourites live in the browser, the catalogue lives behind the API.
 *
 * A Server Action bridges them: the page sends the handles it has in storage
 * and gets back cards. Fetching from the browser instead would put the
 * publishable key and the region lookup in client code for no gain, and would
 * lose the caching every other catalogue read gets.
 */
export async function getWishlistCards(handles: string[]): Promise<ProductCardProps[]> {
  /* Bounded before it reaches the API. The list comes from localStorage, which
     anyone can edit, and an unbounded array becomes an unbounded query. Nobody
     favourites a hundred shirts. */
  const wanted = handles.filter((handle) => typeof handle === "string").slice(0, 100);
  if (wanted.length === 0) return [];

  const regionId = await getRegionId();
  const products = await listProductsByHandles(wanted, regionId);
  return products.map(toCardProps);
}
