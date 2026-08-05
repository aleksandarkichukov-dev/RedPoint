/**
 * Navigation tree for the storefront.
 *
 * Mirrors the real category tree in `@redpoint/catalog`, which was read off the
 * old site's live menu.
 *
 * Every href is the Medusa category handle, because the listing route resolves
 * a category by handle directly. Inventing a prettier path shape would mean a
 * translation table between two naming systems, and a translation table is a
 * place for them to drift apart.
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
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Мъже",
    href: "/men",
    columns: [
      {
        label: "Якета",
        href: "/men-outerwear",
        links: [
          { label: "Якета", href: "/men-jackets" },
          { label: "Суичъри", href: "/men-sweatshirts" },
          { label: "Грейки", href: "/men-padded-jackets" },
        ],
      },
      {
        label: "Блузи",
        href: "/men-tops",
        links: [
          { label: "Тениски", href: "/men-tshirts" },
          { label: "Тениски с яки", href: "/men-polo" },
          { label: "Ризи с къс ръкав", href: "/men-short-sleeve-shirts" },
          { label: "Ризи", href: "/men-shirts" },
          { label: "Блузи", href: "/men-blouses" },
          { label: "Пуловери", href: "/men-sweaters" },
        ],
      },
      {
        label: "Панталони",
        href: "/men-bottoms",
        links: [
          { label: "Дънки", href: "/men-jeans" },
          { label: "Панталони", href: "/men-trousers" },
          { label: "Карго панталони", href: "/men-cargo" },
          { label: "Къси панталони", href: "/men-shorts" },
          { label: "Къси дънки", href: "/men-denim-shorts" },
        ],
      },
      {
        label: "Още",
        href: "/men-accessories",
        links: [
          { label: "Колани", href: "/men-belts" },
          { label: "Портмонета", href: "/men-wallets" },
          { label: "Гривни", href: "/men-bracelets" },
          { label: "Сандали и чехли", href: "/men-sandals" },
          { label: "Боксерки", href: "/men-boxers" },
          { label: "Бански", href: "/men-swimwear" },
        ],
      },
    ],
  },
];

/* "Жени" and "Разпродажба" were removed at the client's request, along with
   the nine products behind them. The sale link used to live outside this array
   because it had no mega menu and was the one nav item allowed to carry the
   accent colour; with it gone, nothing in the navigation is red. */
