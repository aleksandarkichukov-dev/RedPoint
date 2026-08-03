/**
 * Category tree of the old site, taken from its navigation (section 5 of the
 * handoff brief).
 *
 * Only the ids and the hierarchy are hardcoded. The URL slugs are NOT: the old
 * routes look like `/category/{id}/{path}` and nothing guarantees the path
 * segment is stable or that our transcription of it is right. The scraper
 * discovers real category URLs from the live navigation and matches them back
 * to these ids, so a renamed slug does not silently produce an empty run.
 *
 * Some categories carry several ids because the old navigation lists the same
 * label more than once. All of them are crawled; products are de-duplicated by
 * sku afterwards.
 */

export interface CategoryNode {
  /** Stable key used for the Medusa handle in Phase 2. */
  key: string;
  name: string;
  ids: number[];
  children?: CategoryNode[];
}

export const CATEGORY_TREE: CategoryNode[] = [
  {
    key: "men",
    name: "Мъже",
    ids: [5],
    children: [
      { key: "men-jackets", name: "Якета", ids: [14, 39] },
      { key: "men-padded-jackets", name: "Грейки", ids: [42] },
      {
        key: "men-tops",
        name: "Блузи",
        ids: [26, 28],
        children: [
          { key: "men-tshirts", name: "Тениски", ids: [33] },
          { key: "men-polo", name: "Тениски с яки", ids: [43] },
          { key: "men-shirts", name: "Ризи", ids: [30] },
          { key: "men-short-sleeve-shirts", name: "Ризи с къс ръкав", ids: [35] },
          { key: "men-sweaters", name: "Пуловери", ids: [29] },
          { key: "men-sweatshirts", name: "Суичъри", ids: [32] },
        ],
      },
      {
        key: "men-trousers",
        name: "Панталони",
        ids: [15, 31, 110],
        children: [
          { key: "men-jeans", name: "Дънки", ids: [27] },
          { key: "men-shorts", name: "Къси панталони", ids: [34] },
          { key: "men-denim-shorts", name: "Къси дънки", ids: [62] },
        ],
      },
      { key: "men-shoes", name: "Обувки", ids: [45] },
      { key: "men-sandals", name: "Сандали и чехли", ids: [94] },
      {
        key: "men-accessories",
        name: "Аксесоари",
        ids: [17],
        children: [
          { key: "men-belts", name: "Колани", ids: [18] },
          { key: "men-wallets", name: "Портмонета", ids: [19] },
          { key: "men-bracelets", name: "Гривни", ids: [106] },
        ],
      },
      {
        key: "men-underwear",
        name: "Бельо",
        ids: [83],
        children: [
          { key: "men-boxers", name: "Боксерки", ids: [97] },
          { key: "men-swimwear", name: "Бански", ids: [99] },
        ],
      },
      { key: "men-sale", name: "Разпродажба", ids: [81] },
    ],
  },
  {
    key: "women",
    name: "Жени",
    ids: [6],
    children: [
      { key: "women-accessories", name: "Аксесоари", ids: [38] },
      { key: "women-underwear", name: "Бельо", ids: [111] },
      { key: "women-sale", name: "Разпродажба", ids: [82] },
    ],
  },
];

export interface FlatCategory {
  key: string;
  name: string;
  id: number;
  parentKey: string | null;
  /** Depth 0 is a top-level gender node. */
  depth: number;
}

/** Flattens the tree to one entry per category id, which is what the crawler
 *  iterates over. */
export function flattenCategories(
  nodes: CategoryNode[] = CATEGORY_TREE,
  parentKey: string | null = null,
  depth = 0,
): FlatCategory[] {
  return nodes.flatMap((node) => [
    ...node.ids.map((id) => ({
      key: node.key,
      name: node.name,
      id,
      parentKey,
      depth,
    })),
    ...flattenCategories(node.children ?? [], node.key, depth + 1),
  ]);
}

/**
 * Leaf categories only. Parent nodes on the old site list everything their
 * children list, so crawling both just burns Cloudflare budget on duplicates.
 * The gender roots and the sale categories are kept because sale is where the
 * discounted prices live and it is not a child of anything.
 */
export function crawlableCategories(): FlatCategory[] {
  const all = flattenCategories();
  const parentKeys = new Set(
    all.filter((c) => c.parentKey !== null).map((c) => c.parentKey as string),
  );
  return all.filter((c) => !parentKeys.has(c.key) || c.key.endsWith("-sale"));
}
