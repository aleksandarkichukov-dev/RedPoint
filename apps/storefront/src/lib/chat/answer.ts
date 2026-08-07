"use server";

import { detectIntent, rank } from "@redpoint/catalog";
import { medusaFetch, medusaMutate } from "@/lib/medusa";
import {
  getRegionId,
  listAllProducts,
  productHref,
  cardTitle,
  toColorOptions,
  displayPrice,
  type StoreProduct,
} from "@/lib/catalog";
import { STORES } from "@/lib/home";
import { formatEur } from "@/lib/price";

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

/**
 * The buttons offered under an answer.
 *
 * The shop's own questions when it has written any, ours otherwise. Three,
 * because a row of buttons stops being a shortcut somewhere around four and
 * starts being a menu to read.
 */
function openers(entries: { question: string }[]): string[] {
  return entries.length > 0 ? entries.slice(0, 3).map((entry) => entry.question) : OPENING;
}

interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
}

/** What the shop has written for itself, from the admin screen. */
async function faq(): Promise<FaqEntry[]> {
  try {
    const { faq: entries } = await medusaFetch<{ faq: FaqEntry[] }>("/store/faq");
    return entries;
  } catch {
    /* An unreachable FAQ must not take the bot down with it. Everything else it
       answers comes from the catalogue and from fixed strings, and those still
       work. */
    return [];
  }
}

/**
 * The shop's own answer to this question, if it has written one.
 *
 * Matched over the question and its keywords together, so the client can add
 * `малко ми е` to a question phrased `мога ли да заменя размер` and have both
 * reach the same answer. Held to the same threshold as the catalogue search —
 * a half-matched FAQ entry is a confidently wrong answer, which is worse here
 * than in a product list because there is no photograph to disagree with it.
 */
function matchFaq(entries: FaqEntry[], query: string): FaqEntry | null {
  const hit = rank(query, entries, (entry) => `${entry.question} ${entry.keywords.join(" ")}`, {
    limit: 1,
  })[0];

  return hit?.item ?? null;
}

/** Every product, once, cached like the rest of the catalogue. */
async function catalogue(): Promise<StoreProduct[]> {
  const regionId = await getRegionId();
  /* Walked in pages. This used to take one page of a hundred and say in a
     comment that the shop would outgrow it one day — which it was three
     articles away from doing, and the outgrowing would have looked like a bot
     that answers "нямам такъв артикул" about something on the shelf. */
  return listAllProducts({ regionId });
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

/**
 * What a product can be found by: its name, its colours, its category.
 *
 * Not the description. That was ranked once and put a sweatshirt at the top of
 * a search for black t-shirts, because these descriptions say what to wear a
 * garment WITH — half of them mention дънки or тениска while being neither.
 *
 * The colours matter because they are not in the title. `бежав панталон`
 * returned nothing while a beige pair sat on the page behind the panel: the
 * title is `Мъжки карго панталон` and the colour lives on the variants. The
 * category carries the plural nobody's title uses — `якета` is a category,
 * while every jacket is called `яке`.
 *
 * All three are attributes of the thing itself, which is the line between this
 * and the description: prose about a garment can name anything at all.
 */
function searchText(product: StoreProduct): string {
  const colors = toColorOptions(product)
    .map((color) => color.name)
    .join(" ");
  const categories = (product.categories ?? []).map((category) => category.name).join(" ");

  return `${product.title} ${colors} ${categories}`;
}

interface OrderStatus {
  displayId: number;
  placedAt: string;
  status: string;
  shipped: boolean;
  packed: boolean;
  paid: boolean;
  total: number;
  itemCount: number;
  shippingMethod: string | null;
}

async function lookupOrder(orderNumber: string, email: string): Promise<OrderStatus | null> {
  try {
    const { order } = await medusaMutate<{ order: OrderStatus }>("/store/order-lookup", {
      body: { orderNumber: Number(orderNumber), email },
    });
    return order;
  } catch {
    /* Not found, wrong email and too many attempts all arrive here, and all
       three get the same answer from the caller — the same reason the route
       does not distinguish them. */
    return null;
  }
}

/**
 * An order's state, in the words a person uses.
 *
 * Medusa's own vocabulary — `not_fulfilled`, `awaiting` — answers a question
 * nobody asked. What a shopper wants to know is whether it has left the shop
 * yet, so that is the sentence.
 */
function describeOrder(order: OrderStatus): string {
  const placed = new Date(order.placedAt).toLocaleDateString("bg-BG", {
    day: "numeric",
    month: "long",
  });

  const where =
    order.status === "canceled"
      ? "Тази поръчка е отказана."
      : order.shipped
        ? "Предадена е на куриера."
        : order.packed
          ? "Опакована е и чака куриера."
          : "Приготвяме я. Ще я предадем на куриера до следващия работен ден.";

  const paid =
    order.paid
      ? "Платена."
      : order.shippingMethod
        ? "Плащането е при получаване."
        : "";

  return [
    `Поръчка № ${order.displayId} от ${placed}, ${order.itemCount} артикула, ${formatEur(order.total)}.`,
    where,
    paid,
  ]
    .filter(Boolean)
    .join(" ");
}

function articleOf(product: StoreProduct): string | null {
  return product.metadata?.article_no ?? null;
}

export async function ask(message: string): Promise<ChatAnswer> {
  const intent = detectIntent(message);
  const entries = await faq();

  /* The shop's own answers win over the built-in ones, and are asked before
     anything except an article number. That is what makes this screen worth
     having: the client can correct what the bot says about delivery without
     anybody touching the code, and their wording beats ours by default.
     An article number still comes first — a label in someone's hand is not a
     question anybody writes an FAQ entry for. */
  if (intent.kind !== "article" && intent.kind !== "stock") {
    const written = matchFaq(entries, message);
    if (written) return { text: written.answer, suggestions: openers(entries) };
  }

  switch (intent.kind) {
    case "greeting":
      return {
        text: "Здравейте. Мога да проверя дреха по артикулен номер или по име, да кажа какви размери има в момента, и да отговоря за доставка, връщане и магазините.",
        suggestions: openers(entries),
      };

    case "article":
    case "stock": {
      const products = await catalogue();
      const found = products.find((product) => articleOf(product) === intent.article);

      if (!found) {
        return {
          text: `Не намирам артикул ${intent.article}. Проверете номера от етикета — възможно е и дрехата вече да не се предлага.`,
          suggestions: openers(entries),
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
      const hits = rank(intent.query ?? message, products, searchText, { limit: 3 });

      if (hits.length === 0) {
        return {
          text: "Не намирам такова нещо. Опитайте с друга дума или с артикулния номер от етикета.",
          links: [{ label: "виж цялата колекция", href: "/men" }],
          suggestions: openers(entries),
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

    case "order": {
      /* Both, or neither. The number alone is guessable and the email alone
         would list a stranger's purchases; the shop front asks for the pair the
         same way the route demands it. */
      if (!intent.email || !intent.orderNumber) {
        return {
          text: intent.orderNumber
            ? `Намерих номер ${intent.orderNumber}. Напишете и имейла, с който е направена поръчката, и ще проверя.`
            : "Напишете номера на поръчката и имейла, с който е направена — двете заедно, в едно съобщение. И двете са в писмото с потвърждението.",
        };
      }

      const status = await lookupOrder(intent.orderNumber, intent.email);
      if (!status) {
        return {
          text: "Не намирам такава поръчка. Проверете номера и имейла — те са в писмото с потвърждението.",
          phones: STORES.slice(0, 1).map((store) => ({ name: store.name, phone: store.phone })),
        };
      }

      return { text: describeOrder(status) };
    }

    case "human":
      return {
        text: "Разбира се. Обадете се на който магазин ви е удобен:",
        phones: STORES.map((store) => ({ name: store.name, phone: store.phone })),
      };

    default:
      return {
        text: "Не разбрах въпроса. Мога да проверя дреха по артикулен номер или по име, и да отговоря за доставка, връщане, плащане и магазините.",
        suggestions: openers(entries),
      };
  }
}
