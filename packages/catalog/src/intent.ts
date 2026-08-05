import { articleNumber, normalize, similarity, toCyrillic } from "./search";

/**
 * What is this person asking?
 *
 * Keyword matching, not a model. The shop asks a small, knowable set of
 * questions, and a lookup table answers them instantly, offline, and the same
 * way every time — which is worth more here than breadth. When it does not
 * know, it says so and offers a person.
 *
 * Every keyword is matched against the message in both scripts, so `dostavka`
 * and `доставка` are the same word. That comes free from `toCyrillic`, and it
 * is why the keywords are written in Cyrillic only.
 */

export type IntentKind =
  | "greeting"
  | "article"
  | "stock"
  | "order"
  | "delivery"
  | "returns"
  | "sizes"
  | "stores"
  | "payment"
  | "human"
  | "search"
  | "unknown";

export interface Intent {
  kind: IntentKind;
  /** The article number, when the message carried one. */
  article?: string;
  /** The size asked about, for a stock question. */
  size?: string;
  /** What to search the catalogue for, with the question words removed. */
  query?: string;
}

/* Ordered: the first rule that matches wins, so the specific questions are
   listed above the general ones. `размер` appears in both the stock question
   and the size-chart question, and a message naming an article is asking about
   that article's stock rather than for a size guide. */
const RULES: { kind: IntentKind; words: string[] }[] = [
  { kind: "greeting", words: ["здравей", "здрасти", "добър ден", "добро утро", "добър вечер", "ало", "хей"] },
  { kind: "human", words: ["човек", "оператор", "жив", "телефон", "обадя", "свържете", "консултант"] },
  /* Two words are missing on purpose, both removed after the tests caught
     them. `докъде` scores 0.60 against `къде` and stole "къде се намира
     магазина" from the shops. `изпращане` scores 0.63 against `вращане`, which
     is what a transliterated `vrashtane` becomes, and stole the returns
     question — `доставка` and `куриер` already cover that ground. */
  { kind: "order", words: ["поръчка", "поръчката", "пратка", "пратката", "проследя", "статус"] },
  { kind: "delivery", words: ["доставка", "доставяте", "куриер", "спиди", "еконт", "колко струва доставката"] },
  { kind: "returns", words: ["връщане", "върна", "замяна", "заменя", "рекламация", "не ми стана", "не ми става"] },
  { kind: "payment", words: ["плащане", "платя", "карта", "наложен", "наложения", "фактура"] },
  { kind: "stores", words: ["магазин", "магазина", "магазини", "адрес", "къде се намира", "работно време", "отворен", "варна"] },
  { kind: "sizes", words: ["таблица", "мерки", "размерна", "как да мери", "кой размер"] },
];

/**
 * Words that carry no meaning for a catalogue search.
 *
 * Not politeness — weight. `дай да видя черни тениски` ranked cargo trousers
 * first, because three of its five words appear in every Bulgarian sentence
 * and drowned the two that meant something. `coverage` scores word by word, so
 * a word matching nothing now costs a candidate rather than helping a wrong
 * one, and the ones that could never mean a garment are dropped before it.
 */
const FILLER = [
  "имате", "имали", "ли", "има", "искам", "търся", "бих", "може", "мога",
  "здравейте", "моля", "за", "на", "в", "с", "и", "от", "по", "нещо",
  "мъжки", "мъжка", "мъжко", "някакви", "някакво", "ми", "трябва",
  "дай", "дайте", "да", "видя", "видим", "покажи", "покажете", "пусни",
  "този", "тази", "тези", "тия", "някой", "някаква", "нещата", "май",
  "аз", "ние", "ви", "те", "си", "ще", "как", "какви", "какво", "кои",
];

/**
 * Does this message ask the keyword's question?
 *
 * Trigram similarity, not `includes`. Substring matching failed both ways at
 * once: `наложен` contains `ало`, so a question about payment was read as a
 * greeting, while `работното време` failed to contain `работно време` and a
 * question about opening hours was read as a catalogue search. And a
 * transliterated `vrashtane` arrives as `вращане`, which contains `връщане`
 * nowhere.
 *
 * Padding each word on both sides is what kills the `ало` case: as its own
 * word it carries the boundary trigrams that `наложен` does not have.
 *
 * A single-word keyword is compared against each word of the message; a phrase
 * against the whole of it.
 */
function asks(message: string, keyword: string): boolean {
  const THRESHOLD = 0.6;

  if (keyword.includes(" ")) return similarity(keyword, message) >= THRESHOLD;

  return message
    .split(" ")
    .some((word) => word.length >= 3 && similarity(keyword, word) >= THRESHOLD);
}

/** `размер 32`, `размер XL`, or just `XL` standing alone. */
function sizeIn(text: string): string | undefined {
  const named = text.match(/размер\s+([a-zа-я0-9]{1,4})/i);
  if (named?.[1]) return named[1].toUpperCase();

  const bare = text.match(/(?:^|\s)(xxl|xxxl|[2-5]xl|xl|[sml])(?:\s|$)/i);
  return bare?.[1]?.toUpperCase();
}

export function detectIntent(message: string): Intent {
  const typed = normalize(message);
  const cyrillic = toCyrillic(message);
  const both = `${typed} ${cyrillic}`;

  const article = articleNumber(typed);
  const size = sizeIn(both);

  /* An article number outranks every keyword. Someone who types a number is
     holding a label, and that is the least ambiguous thing anyone sends. */
  if (article) return { kind: size ? "stock" : "article", article, size };

  for (const rule of RULES) {
    if (rule.words.some((word) => asks(both, word))) {
      return { kind: rule.kind, size };
    }
  }

  /* Whatever is left is a catalogue search, with the question words removed so
     `имате ли черна тениска` ranks on `черна тениска`. */
  const query = cyrillic
    .split(" ")
    .filter((word) => word && !FILLER.includes(word))
    .join(" ");

  if (query.replace(/\s/g, "").length < 3) return { kind: "unknown" };

  return { kind: "search", query, size };
}
