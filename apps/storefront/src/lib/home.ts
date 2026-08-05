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

/**
 * Which categories the front page features, and in what order.
 *
 * Merchandising, not catalogue: the client decides what leads the page. The
 * tile's photograph is NOT listed here, because a stock picture of a beach on
 * the jackets tile is worse than no tile at all. Each one shows a real garment
 * from the category it links to, resolved at render time from the catalogue.
 */
export interface FeaturedCategory {
  label: string;
  /** Medusa category handle; the listing route resolves it directly. */
  handle: string;
}

export const FEATURED_CATEGORIES: FeaturedCategory[] = [
  { label: "Якета", handle: "men-jackets" },
  { label: "Дънки", handle: "men-jeans" },
  { label: "Ризи", handle: "men-shirts" },
  { label: "Тениски", handle: "men-tshirts" },
  { label: "Панталони", handle: "men-trousers" },
  { label: "Суичъри", handle: "men-sweatshirts" },
  /* Labelled for the leaf it actually opens. It read "Аксесоари" while linking
     to the belts category, so the tile showed a belt, said accessories, and
     landed on belts. */
  { label: "Колани", handle: "men-belts" },
];

/** What the carousel actually renders, once the photograph is resolved. */
export interface CategoryTile {
  label: string;
  href: string;
  image: string;
  alt: string;
}
