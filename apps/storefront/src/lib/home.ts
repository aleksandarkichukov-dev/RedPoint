/**
 * Content for the home page sections.
 *
 * Static while the catalogue is thin. Phase 4 swaps the product-backed parts
 * for Medusa queries; the category tiles stay editorial because the client
 * chooses which categories to feature, not the catalogue.
 */

export interface CategoryTile {
  label: string;
  href: string;
  image: string;
  alt: string;
}

export const CATEGORY_TILES: CategoryTile[] = [
  {
    label: "Якета",
    href: "/men/jackets",
    image: "https://picsum.photos/seed/redpoint-cat-jackets/800/1200",
    alt: "Мъж с яке",
  },
  {
    label: "Дънки",
    href: "/men/jeans",
    image: "https://picsum.photos/seed/redpoint-cat-jeans/800/1200",
    alt: "Мъжки дънки",
  },
  {
    label: "Ризи",
    href: "/men/shirts",
    image: "https://picsum.photos/seed/redpoint-cat-shirts/800/1200",
    alt: "Мъжка риза",
  },
  {
    label: "Тениски",
    href: "/men/tshirts",
    image: "https://picsum.photos/seed/redpoint-cat-tshirts/800/1200",
    alt: "Мъжка тениска",
  },
  {
    label: "Панталони",
    href: "/men/trousers",
    image: "https://picsum.photos/seed/redpoint-cat-trousers/800/1200",
    alt: "Мъжки панталон",
  },
  {
    label: "Обувки",
    href: "/men/shoes",
    image: "https://picsum.photos/seed/redpoint-cat-shoes/800/1200",
    alt: "Мъжки обувки",
  },
  {
    label: "Аксесоари",
    href: "/men/accessories",
    image: "https://picsum.photos/seed/redpoint-cat-accessories/800/1200",
    alt: "Колан и портмоне",
  },
];
