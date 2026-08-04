/**
 * Editorial content for the home page.
 *
 * Only the parts the catalogue does not own. The two product sections read
 * Medusa directly; the category tiles stay here because the client chooses
 * which categories to feature on the front page, and that is a merchandising
 * decision rather than a fact about the catalogue.
 */

export const MANIFESTO = [
  { figure: "20", label: "години във Варна" },
  { figure: "3", label: "магазина в центъра и в Grand Mall" },
  { figure: "24ч", label: "доставка на следващия ден в цялата страна" },
];

/**
 * The three shops, taken from the second JSON-LD block on the old site rather
 * than retyped. Also feeds the chatbot in Phase 8.
 */
export interface Store {
  name: string;
  address: string;
  phone: string;
  hours: string;
  mapsUrl: string;
}

export const STORES: Store[] = [
  {
    name: "Владислав Варненчик",
    address: "бул. „Владислав Варненчик“ 15",
    phone: "+359 89 247 5402",
    hours: "10:00 - 19:30",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Red+Point+Владислав+Варненчик+15+Варна",
  },
  {
    name: "Хотел Черно море",
    address: "ул. „Стефан Караджа“ 10",
    phone: "+359 89 545 6718",
    hours: "10:00 - 20:00",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Red+Point+Стефан+Караджа+10+Варна",
  },
  {
    name: "Grand Mall",
    address: "ул. „Академик Андрей Сахаров“ 2",
    phone: "+359 89 247 3850",
    hours: "10:00 - 22:00",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Red+Point+Grand+Mall+Варна",
  },
];

export interface CategoryTile {
  label: string;
  href: string;
  image: string;
  alt: string;
}

/** Hrefs are Medusa category handles, which is what the listing route resolves. */
export const CATEGORY_TILES: CategoryTile[] = [
  {
    label: "Якета",
    href: "/men-jackets",
    image: "https://picsum.photos/seed/redpoint-cat-jackets/800/1200",
    alt: "Мъж с яке",
  },
  {
    label: "Дънки",
    href: "/men-jeans",
    image: "https://picsum.photos/seed/redpoint-cat-jeans/800/1200",
    alt: "Мъжки дънки",
  },
  {
    label: "Ризи",
    href: "/men-shirts",
    image: "https://picsum.photos/seed/redpoint-cat-shirts/800/1200",
    alt: "Мъжка риза",
  },
  {
    label: "Тениски",
    href: "/men-tshirts",
    image: "https://picsum.photos/seed/redpoint-cat-tshirts/800/1200",
    alt: "Мъжка тениска",
  },
  {
    label: "Панталони",
    href: "/men-bottoms",
    image: "https://picsum.photos/seed/redpoint-cat-trousers/800/1200",
    alt: "Мъжки панталон",
  },
  {
    label: "Обувки",
    href: "/men-shoes",
    image: "https://picsum.photos/seed/redpoint-cat-shoes/800/1200",
    alt: "Мъжки обувки",
  },
  {
    label: "Аксесоари",
    href: "/men-accessories",
    image: "https://picsum.photos/seed/redpoint-cat-accessories/800/1200",
    alt: "Колан и портмоне",
  },
];
