"use server";

import { detectIntent, rank } from "@redpoint/catalog";
import {
  getRegionId,
  listProducts,
  productHref,
  cardTitle,
  toColorOptions,
  displayPrice,
  type StoreProduct,
} from "@/lib/catalog";
import { STORES } from "@/lib/home";

/**
 * The chatbot's one server entry point.
 *
 * A Server Action rather than an API route: it needs the catalogue and the
 * region the same way every other page does, and going through the same
 * cached reads means the bot cannot quote a price the shop is not showing.
 *
 * There is no model here and no call to anything outside. Every answer is
 * built from the catalogue or from a fixed string, which is what makes it
 * instant, free, and identical every time it is asked.
 */

export interface ChatProduct {
  title: string;
  href: string;
  price: number;
  image?: string;
  /** Sizes with stock, in the order the product lists them. */
  sizes: string[];
  soldOut: boolean;
}

export interface ChatAnswer {
  text: string;
  products?: ChatProduct[];
  links?: { label: string; href: string }[];
  phones?: { name: string; phone: string }[];
  /** Buttons offering the next question, shown under the answer. */
  suggestions?: string[];
}

const OPENING = [
  "какво е доставката",
  "как връщам дреха",
  "къде са магазините",
];

/** Every product, once, cached like the rest of the catalogue. */
async function catalogue(): Promise<StoreProduct[]> {
  const regionId = await getRegionId();
  /* One page covers the shop. If the catalogue ever outgrows this the search
     has to move to the database, and the number is here so that shows up as a
     decision rather than as a bot that quietly stops finding new arrivals. */
  const { products } = await listProducts({ regionId, limit: 100 });
  return products;
}

function toChatProduct(product: StoreProduct): ChatProduct {
  const colors = toColorOptions(product);
  const sizes = colors
    .flatMap((color) => color.sizes)
    .filter((size) => size.inStock)
    .map((size) => size.label);

  return {
    /* The same title the cards show, so the article number stays off the
       shop front here too — it is on the product page, where someone who is
       holding a label goes to check it. */
    title: cardTitle(product),
    href: productHref(product),
    price: displayPrice(product) ?? 0,
    image: colors[0]?.images[0] ?? product.images[0]?.url,
    sizes: [...new Set(sizes)],
    soldOut: sizes.length === 0,
  };
}

function articleOf(product: StoreProduct): string | null {
  return product.metadata?.article_no ?? null;
}

export async function ask(message: string): Promise<ChatAnswer> {
  const intent = detectIntent(message);

  switch (intent.kind) {
    case "greeting":
      return {
        text: "Здравейте. Мога да проверя дреха по артикулен номер или по име, да кажа какви размери има в момента, и да отговоря за доставка, връщане и магазините.",
        suggestions: OPENING,
      };

    case "article":
    case "stock": {
      const products = await catalogue();
      const found = products.find((product) => articleOf(product) === intent.article);

      if (!found) {
        return {
          text: `Не намирам артикул ${intent.article}. Проверете номера от етикета — възможно е и дрехата вече да не се предлага.`,
          suggestions: OPENING,
        };
      }

      const card = toChatProduct(found);

      if (intent.size) {
        const has = card.sizes.some(
          (size) => size.toUpperCase() === intent.size!.toUpperCase(),
        );
        return {
          text: has
            ? `Да, размер ${intent.size} е наличен.`
            : card.soldOut
              ? `Артикул ${intent.article} е изчерпан във всички размери.`
              : `Размер ${intent.size} е изчерпан. В момента има ${card.sizes.join(", ")}.`,
          products: [card],
        };
      }

      return {
        text: card.soldOut
          ? "Намерих я, но в момента е изчерпана."
          : `Ето я. Налични размери: ${card.sizes.join(", ")}.`,
        products: [card],
      };
    }

    case "search": {
      const products = await catalogue();
      /* Titles only, and this was learned the hard way. Ranking over the
         description too put a sweatshirt at the top of a search for black
         t-shirts, because these descriptions suggest what to wear a garment
         with — half of them mention дънки or тениска while being neither. A
         title names what the thing IS. */
      const hits = rank(intent.query ?? message, products, (product) => product.title, {
        limit: 3,
      });

      if (hits.length === 0) {
        return {
          text: "Не намирам такова нещо. Опитайте с друга дума или с артикулния номер от етикета.",
          links: [{ label: "виж цялата колекция", href: "/men" }],
          suggestions: OPENING,
        };
      }

      const cards = hits.map((hit) => toChatProduct(hit.item));

      if (intent.size) {
        const withSize = cards.filter((card) =>
          card.sizes.some((size) => size.toUpperCase() === intent.size!.toUpperCase()),
        );
        return withSize.length > 0
          ? { text: `Ето какво има в размер ${intent.size}:`, products: withSize }
          : {
              text: `Намерих това, но нито едно не е налично в размер ${intent.size}.`,
              products: cards,
            };
      }

      return { text: "Ето какво намерих:", products: cards };
    }

    case "delivery":
      return {
        text: "Доставяме със Спиди и Еконт в цяла България. До офис — 2,55 €, до адрес — 3,06 €. Поръчка до 16:00 в работен ден тръгва същия ден.",
        links: [{ label: "пълните условия за доставка", href: "/help/delivery" }],
      };

    case "returns":
      return {
        text: "Връщате до 14 дни от получаването, ако дрехата не е носена и етикетите са по нея. Замяна на размер става на място в магазин.",
        links: [{ label: "как става връщането", href: "/help/returns" }],
      };

    case "sizes":
      return {
        text: "Всяка дреха има собствена таблица с мерки, снета от нея в магазина — намира се на страницата на артикула под размерите.",
        links: [{ label: "как да мерите", href: "/help/sizes" }],
      };

    case "payment":
      return {
        text: "Плащате с карта при поръчката или в брой на куриера. Наложеният платеж е без такса — сумата е същата и по двата начина.",
        links: [{ label: "повече за доставката", href: "/help/delivery" }],
      };

    case "stores":
      return {
        text: "Три магазина във Варна:",
        phones: STORES.map((store) => ({
          name: `${store.name} · ${store.address} · ${store.hours}`,
          phone: store.phone,
        })),
        links: [{ label: "адреси и карта", href: "/help/contact" }],
      };

    case "order":
      /* Deliberately a phone number rather than a lookup form. An order status
         needs the order number and the email together, and until that is built
         behind a rate limit, guessing at it here would either answer nobody or
         answer the wrong person. */
      return {
        text: "За конкретна поръчка се обадете в магазина или отговорете на имейла с потвърждението — там е номерът ѝ.",
        phones: STORES.slice(0, 1).map((store) => ({ name: store.name, phone: store.phone })),
      };

    case "human":
      return {
        text: "Разбира се. Обадете се на който магазин ви е удобен:",
        phones: STORES.map((store) => ({ name: store.name, phone: store.phone })),
      };

    default:
      return {
        text: "Не разбрах въпроса. Мога да проверя дреха по артикулен номер или по име, и да отговоря за доставка, връщане, плащане и магазините.",
        suggestions: OPENING,
      };
  }
}
