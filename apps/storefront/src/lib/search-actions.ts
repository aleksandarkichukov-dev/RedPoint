"use server";

import { articleNumber, rank } from "@redpoint/catalog";
import {
  cardTitle,
  displayPrice,
  getRegionId,
  listCategories,
  listAllProducts,
  productHref,
  toColorOptions,
  type StoreProduct,
} from "@/lib/catalog";

/**
 * The search behind the magnifying glass.
 *
 * Same matcher as the chat: normalised, transliterated from Latin, compared by
 * trigram coverage with a consonant-skeleton fallback. So `denki`, `дънки` and
 * a typed `бежав` all land where a shopper means them to.
 *
 * Categories are searched alongside products because that is how people say
 * what they want. Someone typing `якета` is naming a category — no product is
 * called that, every jacket is `яке` — and answering with a section beats
 * answering with four jackets that happen to rank.
 */

export interface SearchHit {
  title: string;
  href: string;
  price: number;
  image?: string;
  sizes: string[];
  soldOut: boolean;
  /** The article number, shown only when it is what was searched for. */
  article?: string;
}

export interface SearchResults {
  categories: { name: string; href: string }[];
  products: SearchHit[];
  /** True when the query was an article number and matched exactly. */
  byArticle: boolean;
}

const EMPTY: SearchResults = { categories: [], products: [], byArticle: false };

function toHit(product: StoreProduct, withArticle = false): SearchHit {
  const colors = toColorOptions(product);
  const sizes = [
    ...new Set(
      colors
        .flatMap((color) => color.sizes)
        .filter((size) => size.inStock)
        .map((size) => size.label),
    ),
  ];

  return {
    title: cardTitle(product),
    href: productHref(product),
    price: displayPrice(product) ?? 0,
    image: colors[0]?.images[0] ?? product.images[0]?.url,
    sizes,
    soldOut: sizes.length === 0,
    ...(withArticle ? { article: product.metadata?.article_no ?? undefined } : {}),
  };
}

function searchText(product: StoreProduct): string {
  const colors = toColorOptions(product)
    .map((color) => color.name)
    .join(" ");
  const categories = (product.categories ?? []).map((category) => category.name).join(" ");

  /* Name, colour and category — never the description. Those say what to wear a
     garment WITH, so half of them name дънки or тениска while being neither,
     and ranking on them puts a sweatshirt at the top of a search for t-shirts. */
  return `${product.title} ${colors} ${categories}`;
}

export async function search(query: string): Promise<SearchResults> {
  const typed = query.trim();
  if (typed.length < 2) return EMPTY;

  const regionId = await getRegionId();
  /* The whole catalogue. Ranking happens here in memory, so anything not
     fetched is not merely ranked low — it does not exist as far as the search
     box is concerned, and the shopper is told there is no such thing. */
  const products = await listAllProducts({ regionId });

  /* An article number is an exact question and gets an exact answer. Somebody
     holding a label does not want the six garments that rank near it. */
  const article = articleNumber(typed);
  if (article) {
    const found = products.find((product) => product.metadata?.article_no === article);
    if (found) return { categories: [], products: [toHit(found, true)], byArticle: true };
  }

  const categories = await listCategories();
  /* Leaves only. A parent like "Мъже" is a whole shop, not an answer, and
     offering it beside a real section makes the real one look like a guess. */
  const leaves = categories.filter(
    (category) => !categories.some((other) => other.parent_category_id === category.id),
  );

  return {
    categories: rank(typed, leaves, (category) => category.name, { limit: 3 }).map((hit) => ({
      name: hit.item.name,
      href: `/${hit.item.handle}`,
    })),
    products: rank(typed, products, searchText, { limit: 8 }).map((hit) => toHit(hit.item)),
    byArticle: false,
  };
}
