/**
 * Category tree of the old site.
 *
 * Read off the live mega menu, NOT transcribed from section 5 of the brief.
 * The brief's version is wrong in ways that matter: it treats group ids as
 * leaves, files Суичъри under Блузи instead of Якета, misses Блузи and
 * Панталони as subcategories in their own right, and lists Карго Панталони
 * (110) as one of the Панталони group's ids rather than a subcategory of it.
 * Crawling that version would have hit group pages and missed real leaves.
 *
 * Group nodes carry the id the menu uses for their heading. They are not
 * crawled: a group page lists everything its children list, so visiting both
 * only spends Cloudflare budget on duplicates.
 *
 * Only ids and hierarchy are hardcoded. URLs are discovered from the live
 * navigation at run time, so a renamed slug cannot produce a silently empty
 * crawl.
 */

export interface CategoryNode {
  /** Stable key, used as the Medusa handle. */
  key: string;
  name: string;
  id: number;
  children?: CategoryNode[];
}

export const CATEGORY_TREE: CategoryNode[] = [
  {
    key: "men",
    name: "Мъже",
    id: 5,
    children: [
      {
        key: "men-outerwear",
        name: "Якета",
        id: 14,
        children: [
          { key: "men-jackets", name: "Якета", id: 39 },
          { key: "men-sweatshirts", name: "Суичъри", id: 32 },
          { key: "men-padded-jackets", name: "Грейки", id: 42 },
        ],
      },
      {
        key: "men-tops",
        name: "Блузи",
        id: 26,
        children: [
          { key: "men-tshirts", name: "Тениски", id: 33 },
          { key: "men-polo", name: "Тениски с яки", id: 43 },
          { key: "men-short-sleeve-shirts", name: "Ризи с къс ръкав", id: 35 },
          { key: "men-shirts", name: "Ризи", id: 30 },
          { key: "men-blouses", name: "Блузи", id: 28 },
          { key: "men-sweaters", name: "Пуловери", id: 29 },
        ],
      },
      {
        key: "men-bottoms",
        name: "Панталони",
        id: 15,
        children: [
          { key: "men-denim-shorts", name: "Къси дънки", id: 62 },
          { key: "men-shorts", name: "Къси панталони", id: 34 },
          { key: "men-jeans", name: "Дънки", id: 27 },
          { key: "men-trousers", name: "Панталони", id: 31 },
          { key: "men-cargo", name: "Карго панталони", id: 110 },
        ],
      },
      {
        key: "men-accessories",
        name: "Аксесоари",
        id: 17,
        children: [
          { key: "men-belts", name: "Колани", id: 18 },
          { key: "men-wallets", name: "Портмонета", id: 19 },
          { key: "men-bracelets", name: "Гривни", id: 106 },
        ],
      },
      {
        key: "men-shoes",
        name: "Обувки",
        id: 45,
        children: [{ key: "men-sandals", name: "Сандали и чехли", id: 94 }],
      },
      {
        key: "men-underwear",
        name: "Бельо",
        id: 83,
        children: [
          { key: "men-swimwear", name: "Бански", id: 99 },
          { key: "men-boxers", name: "Боксерки", id: 97 },
        ],
      },
      { key: "men-sale", name: "Разпродажба", id: 81 },
    ],
  },
  {
    key: "women",
    name: "Жени",
    id: 6,
    children: [
      { key: "women-accessories", name: "Аксесоари", id: 38 },
      { key: "women-underwear", name: "Бельо", id: 111 },
      { key: "women-sale", name: "Разпродажба", id: 82 },
    ],
  },
];

export interface FlatCategory {
  key: string;
  name: string;
  id: number;
  parentKey: string | null;
  /** Depth 0 is a gender root. */
  depth: number;
}

export function flattenCategories(
  nodes: CategoryNode[] = CATEGORY_TREE,
  parentKey: string | null = null,
  depth = 0,
): FlatCategory[] {
  return nodes.flatMap((node) => [
    { key: node.key, name: node.name, id: node.id, parentKey, depth },
    ...flattenCategories(node.children ?? [], node.key, depth + 1),
  ]);
}

function findNode(nodes: CategoryNode[], key: string): CategoryNode | undefined {
  for (const node of nodes) {
    if (node.key === key) return node;
    const found = findNode(node.children ?? [], key);
    if (found) return found;
  }
  return undefined;
}

/**
 * Leaves only. A group page lists everything its children list, so crawling
 * both doubles the request count for nothing.
 */
export function crawlableCategories(): FlatCategory[] {
  return flattenCategories().filter(
    (category) => !findNode(CATEGORY_TREE, category.key)?.children?.length,
  );
}
