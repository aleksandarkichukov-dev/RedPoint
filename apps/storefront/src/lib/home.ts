/**
 * Content for the home page sections.
 *
 * Static while the catalogue is thin. Phase 4 swaps the product-backed parts
 * for Medusa queries; the category tiles stay editorial because the client
 * chooses which categories to feature, not the catalogue.
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
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Red+Point+Владислав+Варненчик+15+Варна",
  },
  {
    name: "Хотел Черно море",
    address: "ул. „Стефан Караджа“ 10",
    phone: "+359 89 545 6718",
    hours: "10:00 - 20:00",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Red+Point+Стефан+Караджа+10+Варна",
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
 * PLACEHOLDER PRODUCTS.
 *
 * The catalogue holds one seeded product, so the two product sections would
 * otherwise render empty and hide their own layout problems. Phase 4 replaces
 * this with a Medusa query; the components already take the shape they will
 * receive, so the swap is a prop change and nothing else.
 */
export interface DemoProduct {
  href: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  images: { src: string; alt?: string }[];
  colors: { id: string; name: string; hex: string }[];
}

const SWATCHES = [
  { id: "black", name: "Черно", hex: "#101010" },
  { id: "grey", name: "Сиво", hex: "#8B8F93" },
  { id: "navy", name: "Тъмносиньо", hex: "#1F2A44" },
  { id: "sand", name: "Пясъчно", hex: "#C8B79A" },
];

export const NEW_ARRIVALS: DemoProduct[] = [
  {
    href: "/men/jackets",
    name: "Преходно яке с яка",
    price: 89.9,
    images: [
      { src: "https://picsum.photos/seed/redpoint-new-1a/502/616", alt: "Преходно яке, преден изглед" },
      { src: "https://picsum.photos/seed/redpoint-new-1b/502/616" },
    ],
    colors: SWATCHES.slice(0, 3),
  },
  {
    href: "/men/shirts",
    name: "Риза с дълъг ръкав",
    price: 42,
    images: [
      { src: "https://picsum.photos/seed/redpoint-new-2a/502/616", alt: "Риза с дълъг ръкав" },
      { src: "https://picsum.photos/seed/redpoint-new-2b/502/616" },
    ],
    colors: SWATCHES.slice(1, 3),
  },
  {
    href: "/men/jeans",
    name: "Дънки права кройка",
    price: 65,
    images: [
      { src: "https://picsum.photos/seed/redpoint-new-3a/502/616", alt: "Дънки права кройка" },
      { src: "https://picsum.photos/seed/redpoint-new-3b/502/616" },
    ],
    colors: SWATCHES,
  },
  {
    href: "/men/sweatshirts",
    name: "Суичър с качулка",
    price: 54.5,
    images: [
      { src: "https://picsum.photos/seed/redpoint-new-4a/502/616", alt: "Суичър с качулка" },
      { src: "https://picsum.photos/seed/redpoint-new-4b/502/616" },
    ],
    colors: SWATCHES.slice(0, 2),
  },
];

export const ON_SALE: DemoProduct[] = [
  {
    href: "/sale",
    name: "Пуфер яке с качулка",
    price: 69.4,
    compareAtPrice: 138.9,
    images: [{ src: "https://picsum.photos/seed/redpoint-sale-1/502/616", alt: "Пуфер яке" }],
    colors: SWATCHES.slice(0, 2),
  },
  {
    href: "/sale",
    name: "Спортна блуза",
    price: 27.9,
    compareAtPrice: 52.8,
    images: [{ src: "https://picsum.photos/seed/redpoint-sale-2/502/616", alt: "Спортна блуза" }],
    colors: SWATCHES.slice(1, 4),
  },
  {
    href: "/sale",
    name: "Карго панталон",
    price: 28,
    compareAtPrice: 56,
    images: [{ src: "https://picsum.photos/seed/redpoint-sale-3/502/616", alt: "Карго панталон" }],
    colors: SWATCHES.slice(2, 4),
  },
  {
    href: "/sale",
    name: "Тениска с щампа",
    price: 16,
    compareAtPrice: 32,
    images: [{ src: "https://picsum.photos/seed/redpoint-sale-4/502/616", alt: "Тениска с щампа" }],
    colors: SWATCHES.slice(0, 3),
  },
  {
    href: "/sale",
    name: "Елегантно преходно яке",
    price: 110.5,
    compareAtPrice: 221,
    images: [{ src: "https://picsum.photos/seed/redpoint-sale-5/502/616", alt: "Елегантно яке" }],
    colors: SWATCHES.slice(1, 3),
  },
];

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
