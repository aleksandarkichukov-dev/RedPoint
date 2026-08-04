/**
 * Navigation tree for the storefront.
 *
 * Mirrors the real category tree in `@redpoint/catalog`, which was read off the
 * old site's live menu. Phase 4 replaces this with the ProductCategory tree
 * from Medusa; the shape here matches, so that swap is a data source change and
 * not a component rewrite.
 */

export interface NavLink {
  label: string;
  href: string;
}

export interface NavColumn {
  label: string;
  href: string;
  links: NavLink[];
}

export interface NavGroup {
  label: string;
  href: string;
  columns: NavColumn[];
  /** Editorial image shown alongside the mega menu. */
  feature?: { src: string; alt: string; label: string; href: string };
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Мъже",
    href: "/men",
    columns: [
      {
        label: "Якета",
        href: "/men/outerwear",
        links: [
          { label: "Якета", href: "/men/jackets" },
          { label: "Суичъри", href: "/men/sweatshirts" },
          { label: "Грейки", href: "/men/padded-jackets" },
        ],
      },
      {
        label: "Блузи",
        href: "/men/tops",
        links: [
          { label: "Тениски", href: "/men/tshirts" },
          { label: "Тениски с яки", href: "/men/polo" },
          { label: "Ризи с къс ръкав", href: "/men/short-sleeve-shirts" },
          { label: "Ризи", href: "/men/shirts" },
          { label: "Блузи", href: "/men/blouses" },
          { label: "Пуловери", href: "/men/sweaters" },
        ],
      },
      {
        label: "Панталони",
        href: "/men/bottoms",
        links: [
          { label: "Дънки", href: "/men/jeans" },
          { label: "Панталони", href: "/men/trousers" },
          { label: "Карго панталони", href: "/men/cargo" },
          { label: "Къси панталони", href: "/men/shorts" },
          { label: "Къси дънки", href: "/men/denim-shorts" },
        ],
      },
      {
        label: "Още",
        href: "/men/accessories",
        links: [
          { label: "Колани", href: "/men/belts" },
          { label: "Портмонета", href: "/men/wallets" },
          { label: "Гривни", href: "/men/bracelets" },
          { label: "Сандали и чехли", href: "/men/sandals" },
          { label: "Боксерки", href: "/men/boxers" },
          { label: "Бански", href: "/men/swimwear" },
        ],
      },
    ],
    feature: {
      src: "https://picsum.photos/seed/redpoint-nav-men/900/1200",
      alt: "Мъжка есенна колекция",
      label: "есен 2026",
      href: "/men",
    },
  },
  {
    label: "Жени",
    href: "/women",
    columns: [
      {
        label: "Категории",
        href: "/women",
        links: [
          { label: "Аксесоари", href: "/women/accessories" },
          { label: "Бельо", href: "/women/underwear" },
        ],
      },
    ],
    feature: {
      src: "https://picsum.photos/seed/redpoint-nav-women/900/1200",
      alt: "Дамски аксесоари",
      label: "аксесоари",
      href: "/women",
    },
  },
];

/** Kept out of NAV_GROUPS: it has no mega menu, and it is the one nav item
 *  allowed to carry the accent colour. */
export const SALE_LINK: NavLink = { label: "Разпродажба", href: "/sale" };
